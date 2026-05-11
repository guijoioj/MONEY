const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { VendaService } = require('../services');

const service = new VendaService();

// Listar vendas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, tipo, data_inicio, data_fim } = req.query;
    const filtros = {};
    if (status) filtros.status = status;
    if (tipo) filtros.tipo = tipo;
    if (data_inicio && data_fim) { filtros.data_inicio = data_inicio; filtros.data_fim = data_fim; }

    const result = await service.listar(req.salaoId, filtros);
    res.json({ success: result.success, data: result.data || [], error: result.error });
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
router.put('/:id', authMiddleware, requireAdmin, [
  body('status').optional().isIn(['pendente', 'concluida', 'finalizada', 'cancelada'])
    .withMessage('Status inválido (use: pendente, concluida, finalizada, cancelada)'),
  body('forma_pagamento').optional().isString().isLength({ max: 50 }),
  body('observacoes').optional().isString().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

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

// Cancelar venda
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.cancelar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message || 'Venda cancelada' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
