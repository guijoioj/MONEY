const express = require('express');
const router = express.Router();
const { body, query: queryValidator, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { AgendamentoService } = require('../services');
const { sendPush } = require('../services/pushService');
const { pool } = require('../config/database');
const wsService = require('../services/websocketService');

const service = new AgendamentoService();

// Listar agendamentos (com filtros)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, data_inicio, data_fim, cliente_id, profissional_id } = req.query;
    const result = await service.listar(req.salaoId, { status, data_inicio, data_fim, cliente_id, profissional_id });

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agendamentos pendentes (status = 'pendente')
router.get('/pendentes', authMiddleware, async (req, res) => {
  try {
    const result = await service.listar(req.salaoId, { status: 'pendente' });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar agendamento
router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id é obrigatório'),
  body('servico_id').isInt().withMessage('servico_id é obrigatório'),
  body('data_hora').isISO8601().withMessage('data_hora deve ser ISO 8601'),
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
          'SELECT push_token FROM clientes WHERE id = $1 AND push_token IS NOT NULL LIMIT 1',
          [agendamento.cliente_id]
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar agendamento
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.atualizar(req.params.id, req.body, req.salaoId);
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
          'SELECT push_token FROM clientes WHERE id = $1 AND push_token IS NOT NULL LIMIT 1',
          [agendamento.cliente_id]
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
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancelar agendamento
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
