const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Cliente = require('../models/Cliente');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [clientes, total] = await Promise.all([Cliente.getAll(req.query, req.salonId), Cliente.count(req.query, req.salonId)]);
    res.json({ data: clientes, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id, req.salonId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ data: cliente });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('telefone').trim().notEmpty().withMessage('Telefone é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], validate, async (req, res) => {
  try {
    const cliente = await Cliente.create(req.body, req.salonId);
    res.status(201).json({ data: cliente });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.update(req.params.id, req.body, req.salonId);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(cliente);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Cliente.delete(req.params.id, req.salonId);
    if (!result || result.rowCount === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
