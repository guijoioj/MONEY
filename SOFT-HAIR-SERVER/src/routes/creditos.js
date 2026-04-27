const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { CreditoService } = require('../services');

const service = new CreditoService();

router.get('/cliente/:clienteId', authMiddleware, async (req, res) => {
  try {
    const result = await service.listarPorCliente(req.params.clienteId, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id obrigatório'),
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser positivo'),
  body('tipo').isIn(['credito', 'uso']).withMessage('Tipo deve ser credito ou uso'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { cliente_id, valor, tipo, observacoes } = req.body;
    const result = await service.adicionar(cliente_id, valor, tipo, observacoes, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data, message: result.message });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
