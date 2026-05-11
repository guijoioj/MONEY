const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
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
router.post('/', authMiddleware, [
  body('tipo').isIn(['servico', 'produto', 'misto']).withMessage('Tipo deve ser servico, produto ou misto'),
  body('valor_total').isFloat({ min: 0 }).withMessage('Valor total deve ser positivo'),
  body('valor_final').isFloat({ min: 0 }).withMessage('Valor final deve ser positivo'),
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
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.atualizar(req.params.id, req.body, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
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
