const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { AtendimentoService } = require('../services');

const service = new AtendimentoService();

// Listar
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, profissional_id, data_inicio, data_fim, limit } = req.query;
    const result = await service.listar(req.salaoId, { status, profissional_id, data_inicio, data_fim, limit });
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Criar
router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id é obrigatório'),
  body('profissional_id').isInt().withMessage('profissional_id é obrigatório'),
  body('servico_id').isInt().withMessage('servico_id é obrigatório'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.criar(req.body, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.atualizar(req.params.id, req.body, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Deletar
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, message: result.message });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
