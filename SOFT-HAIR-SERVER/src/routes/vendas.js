const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { VendaService } = require('../services');

const service = new VendaService();

// Vendas: admin + recepção. Profissional não vê vendas (sem necessidade operacional).
// DELETE permanece admin-only via requireAdmin individual.
router.use(authMiddleware, requireAnyRole(['admin', 'recepcao']));

// Listar vendas — agora aceita clienteId / cliente_id e profissionalId / profissional_id.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, tipo, data_inicio, data_fim } = req.query;
    const clienteId = req.query.clienteId ?? req.query.cliente_id;
    const profissionalId = req.query.profissionalId ?? req.query.profissional_id;
    const filtros = {};
    if (status) filtros.status = status;
    if (tipo) filtros.tipo = tipo;
    if (data_inicio && data_fim) { filtros.data_inicio = data_inicio; filtros.data_fim = data_fim; }
    if (clienteId) filtros.cliente_id = Number(clienteId);
    if (profissionalId) filtros.profissional_id = Number(profissionalId);

    const result = await service.listar(req.salaoId, filtros);
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Estatísticas — agregado para dashboards. Registrada ANTES de /:id pra não
// cair no router como `id="estatisticas"`.
router.get('/estatisticas', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { data_inicio, data_fim } = req.query;
    const params = [req.salaoId];
    let where = 'v.salao_id = $1 AND COALESCE(v.status, \'pendente\') != \'cancelada\'';
    let p = 2;
    if (data_inicio) { where += ` AND v.created_at::date >= $${p++}`; params.push(data_inicio); }
    if (data_fim)    { where += ` AND v.created_at::date <= $${p++}`; params.push(data_fim); }
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int                              AS qtd_total,
        COUNT(*) FILTER (WHERE COALESCE(v.status,'pendente') = 'paga')::int AS qtd_pagas,
        COUNT(*) FILTER (WHERE COALESCE(v.status,'pendente') = 'pendente')::int AS qtd_pendentes,
        COALESCE(SUM(v.valor_final), 0)::numeric    AS total_faturado,
        COALESCE(AVG(v.valor_final), 0)::numeric    AS ticket_medio
        FROM vendas v
       WHERE ${where}
    `, params);
    res.json({ success: true, data: rows[0] });
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

// Criar venda
// [P3-C2] valor_total / valor_final são recalculados server-side a partir dos itens (não confiar no cliente).
router.post('/', authMiddleware, [
  body('tipo').isIn(['servico', 'produto', 'misto']).withMessage('Tipo deve ser servico, produto ou misto'),
  body('valor_total').optional().isFloat({ min: 0 }).withMessage('Valor total deve ser positivo'),
  body('valor_final').optional().isFloat({ min: 0 }).withMessage('Valor final deve ser positivo'),
  body('desconto').optional().isFloat({ min: 0 }).withMessage('Desconto deve ser positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.criar(req.body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar venda
// [P8-A1] requireAdmin + validator isIn + state machine (service-level)
router.put('/:id', authMiddleware, /* admin+recepcao via router.use no topo */ [
  // Padronizado: pendente | paga | cancelada. Aliases legados aceitos (concluida/finalizada => paga).
  body('status').optional().isIn(['pendente', 'paga', 'concluida', 'finalizada', 'cancelada'])
    .withMessage('Status inválido (use: pendente, paga, cancelada)'),
  body('forma_pagamento').optional().isString().isLength({ max: 50 }),
  body('observacoes').optional().isString().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    // Cancelamento por PUT precisa do MESMO rastro do DELETE.
    // Recepção: exige motivo. Admin: motivo opcional mas registra audit log.
    const wantsCancel = (req.body.status || '').toLowerCase() === 'cancelada';
    if (wantsCancel) {
      const role = req.user?.tipo;
      const motivo = (req.body?.motivo || '').toString().trim();
      if (role === 'recepcao' && motivo.length < 3) {
        return res.status(400).json({ success: false, error: 'motivo obrigatório (mín 3 chars) para cancelar venda.' });
      }
      // STRICT: se audit log falhar, ABORTA o cancelamento.
      try {
        await require('../utils/auditLog').logActionStrict({
          req,
          action: 'venda.cancelar_via_put',
          entityType: 'venda',
          entityId: Number(req.params.id),
          before: null,
          after: { motivo, status_anterior: null },
          salaoId: req.salaoId,
        });
      } catch (e) {
        console.error('[venda.cancelar_via_put] audit log falhou:', e.message);
        return res.status(503).json({ success: false, error: 'Não foi possível registrar a auditoria — cancelamento abortado.' });
      }
    }

    const result = await service.atualizar(req.params.id, req.body, req.salaoId, { req });
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      // Transição inválida → 400; venda não encontrada → 404
      const code = /Transição inválida|Status inválido/i.test(result.error || '') ? 400 : 404;
      res.status(code).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Cancelar venda.
//   Admin: cancela sem motivo obrigatório (auditoria via logAction).
//   Recepção: exige motivo (mín 3 chars) pra criar rastro.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const role = req.user?.tipo;
    if (!['admin', 'recepcao'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Acesso negado.' });
    }
    const motivo = (req.body?.motivo || req.query?.motivo || '').toString().trim();
    if (role === 'recepcao' && motivo.length < 3) {
      return res.status(400).json({ success: false, error: 'motivo obrigatório (mín 3 chars) para cancelar venda.' });
    }
    // STRICT: audit log ANTES de cancelar — se logar falhar, não cancela.
    try {
      await require('../utils/auditLog').logActionStrict({
        req,
        action: 'venda.cancelar',
        entityType: 'venda',
        entityId: Number(req.params.id),
        before: null,
        after: { motivo },
        salaoId: req.salaoId,
      });
    } catch (e) {
      console.error('[venda.cancelar] audit log falhou:', e.message);
      return res.status(503).json({ success: false, error: 'Não foi possível registrar a auditoria — cancelamento abortado.' });
    }
    const result = await service.cancelar(req.params.id, req.salaoId);
    if (!result.success) return res.status(404).json({ success: false, error: result.error });
    res.json({ success: true, message: result.message || 'Venda cancelada' });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
