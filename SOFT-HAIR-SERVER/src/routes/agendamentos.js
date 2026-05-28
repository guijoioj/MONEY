const express = require('express');
const router = express.Router();
const { body, query: queryValidator, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { isProfissionalScope, requireAnyRole } = require('../middleware/role');
const { AgendamentoService } = require('../services');

// Agendamentos:
//   GET (lista, pendentes, proximos, disponiveis, por id) → todos os 3 roles
//       (profissional automaticamente scopado para os próprios via isProfissionalScope)
//   POST/PUT/DELETE → admin + recepção (profissional NÃO cria nem altera).
const writeGuard = requireAnyRole(['admin', 'recepcao']);
const { sendPush } = require('../services/pushService');
const { pool } = require('../config/database');
const wsService = require('../services/websocketService');

const service = new AgendamentoService();

// Listar agendamentos (com filtros)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, data_inicio, data_fim, cliente_id } = req.query;
    // Scoping: profissional só vê os próprios; admin/recepção podem filtrar livremente.
    let profissional_id = req.query.profissional_id;
    if (isProfissionalScope(req)) {
      if (!req.user.profissionalId) {
        return res.status(403).json({ success: false, error: 'Usuário profissional sem vínculo. Contate o administrador.' });
      }
      profissional_id = req.user.profissionalId;
    }
    const result = await service.listar(req.salaoId, { status, data_inicio, data_fim, cliente_id, profissional_id });

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Agendamentos pendentes (status = 'pendente')
router.get('/pendentes', authMiddleware, async (req, res) => {
  try {
    const result = await service.listar(req.salaoId, { status: 'pendente' });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Próximos N dias
router.get('/proximos', authMiddleware, async (req, res) => {
  try {
    const dias = parseInt(req.query.dias || '7', 10);
    const hoje = new Date();
    const fim = new Date();
    fim.setDate(hoje.getDate() + dias);
    const dataInicio = hoje.toISOString().split('T')[0];
    const dataFim = fim.toISOString().split('T')[0];
    const result = await service.listar(req.salaoId, { data_inicio: dataInicio, data_fim: dataFim });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Horários disponíveis
router.get('/disponiveis/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) return res.status(400).json({ success: false, error: 'Parâmetro "data" é obrigatório' });
    const result = await service.getHorariosDisponiveis(req.params.profissionalId, data, req.salaoId);
    res.json({ success: true, data: result.data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Criar agendamento
router.post('/', authMiddleware, writeGuard, [
  // IDs são TEXT (UUID/string) no schema → não usar isInt
  body('cliente_id').exists({ checkFalsy: true }).withMessage('cliente_id é obrigatório'),
  body('servico_id').exists({ checkFalsy: true }).withMessage('servico_id é obrigatório'),
  body('profissional_id').optional({ nullable: true }),
  body('auxiliar_id').optional({ nullable: true }),
  body('data_hora').isISO8601().withMessage('data_hora deve ser ISO 8601')
    // data_hora deve ser razoavelmente futura. Tolerância de 24h para trás
    // (cobre walk-ins/registros retroativos no mesmo dia e clock skew + TZ). Sanidade
    // 100 anos pra frente. Frontend já manda ISO UTC, mas usuária pode digitar manual.
    .custom((v) => {
      const t = new Date(v).getTime();
      const now = Date.now();
      if (Number.isNaN(t)) throw new Error('data_hora inválida');
      if (t < now - 24 * 60 * 60 * 1000) throw new Error('data_hora não pode estar no passado');
      if (t > now + 100 * 365 * 24 * 3600 * 1000) throw new Error('data_hora muito distante no futuro');
      return true;
    }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const result = await service.criar(req.body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
      // Notificar cliente via push
      const agendamento = result.data;
      if (agendamento && agendamento.cliente_id) {
        const clienteRow = await pool.query(
          // [P2-M7] Filtrar por salao_id (defesa em profundidade)
          'SELECT push_token FROM clientes WHERE id = $1 AND salao_id = $2 AND push_token IS NOT NULL LIMIT 1',
          [agendamento.cliente_id, req.salaoId]
        );
        if (clienteRow.rows[0]?.push_token) {
          await sendPush(
            clienteRow.rows[0].push_token,
            'Agendamento recebido! 💇',
            'Seu agendamento foi criado e está aguardando confirmação.',
            { agendamentoId: agendamento.id, screen: 'pedidos' }
          );
        }
      }
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar agendamento
// [P9-A1] requireAdmin + validator isIn + state machine (service-level)
// PUT: admin + recepção (confirmar, remarcar, cancelar, mudar status).
router.put('/:id', authMiddleware, writeGuard, [
  body('status').optional().isIn(['agendado', 'confirmado', 'em_andamento', 'cancelado', 'concluido', 'no_show'])
    .withMessage('Status inválido (use: agendado, confirmado, em_andamento, cancelado, concluido, no_show)'),
  body('observacoes').optional().isString().isLength({ max: 1000 }),
  body('data_hora').optional().isISO8601().withMessage('data_hora deve ser ISO 8601'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const result = await service.atualizar(req.params.id, req.body, req.salaoId, { req });
    if (result.success) {
      res.json({ success: true, data: result.data });
      // Broadcast WebSocket para todos conectados ao salão
      const agendamento = result.data;
      const { status } = req.body;
      wsService.notificarSalao(req.salaoId, {
        type: 'AGENDAMENTO_ATUALIZADO',
        data: {
          agendamentoId: req.params.id,
          status: status || agendamento.status,
          profissionalId: agendamento.profissional_id,
          dataHora: agendamento.data_hora,
        }
      });
      // Notificar cliente via push quando status muda
      if (agendamento && agendamento.cliente_id && status) {
        const clienteRow = await pool.query(
          // [P2-M7] Filtrar por salao_id (defesa em profundidade)
          'SELECT push_token FROM clientes WHERE id = $1 AND salao_id = $2 AND push_token IS NOT NULL LIMIT 1',
          [agendamento.cliente_id, req.salaoId]
        );
        if (clienteRow.rows[0]?.push_token) {
          const msgs = {
            confirmado: 'Seu agendamento foi confirmado! ✅',
            cancelado: 'Seu agendamento foi cancelado.',
            finalizado: 'Seu atendimento foi finalizado. Obrigado! 🙏',
          };
          const body = msgs[status] || `Seu agendamento foi atualizado para: ${status}.`;
          await sendPush(
            clienteRow.rows[0].push_token,
            'Agendamento atualizado 💇',
            body,
            { agendamentoId: agendamento.id, screen: 'pedidos' }
          );
        }
      }
    } else {
      // [P9-A1] Transição inválida / Status inválido / horário ocupado → 400; não encontrado → 404
      const code = /Transição inválida|Status inválido|ocupado|não pertence/i.test(result.error || '') ? 400 : 404;
      res.status(code).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Cancelar agendamento
router.delete('/:id', authMiddleware, writeGuard, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
