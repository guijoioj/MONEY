const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { ComissaoService } = require('../services');

const service = new ComissaoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { profissional_id, pago, data_inicio, data_fim } = req.query;
    const result = await service.listar(req.salaoId, { profissional_id, pago, data_inicio, data_fim });
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/resumo/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ success: false, error: 'data_inicio e data_fim obrigatórios' });
    const result = await service.resumoPorProfissional(req.salaoId, req.params.profissionalId, data_inicio, data_fim);
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const result = await service.criar(req.body, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/pagar', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarComoPaga(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data, message: result.message });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
