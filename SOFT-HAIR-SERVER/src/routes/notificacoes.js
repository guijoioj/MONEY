const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { NotificacaoService } = require('../services');

const service = new NotificacaoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { lida, tipo, limit } = req.query;
    const result = await service.listar(req.salaoId, { lida, tipo, limit });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/count', authMiddleware, async (req, res) => {
  try {
    const result = await service.contarNaoLidas(req.salaoId);
    res.json({ success: true, data: result.data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.post('/', authMiddleware, [
  body('tipo').notEmpty().withMessage('Tipo obrigatório'),
  body('titulo').notEmpty().withMessage('Título obrigatório'),
  body('mensagem').notEmpty().withMessage('Mensagem obrigatória'),
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

router.put('/:id/lida', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarComoLida(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.put('/marcar-todas-lidas', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarTodasComoLidas(req.salaoId);
    res.json({ success: true, message: result.message });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

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
