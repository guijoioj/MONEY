const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Produto = require('../models/Produto');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [produtos, categorias] = await Promise.all([Produto.getAll(req.query, req.salonId), Produto.getCategorias(req.salonId)]);
    res.json({ data: produtos, categorias });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/categorias', async (req, res) => {
  try { res.json({ data: await Produto.getCategorias(req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/estoque-baixo', async (req, res) => {
  try { res.json({ data: await Produto.getEstoqueBaixo(req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const p = await Produto.findById(req.params.id, req.salonId);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ data: p });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', [body('nome').trim().notEmpty(), body('precoVenda').isFloat({ min: 0 })], validate, async (req, res) => {
  try { res.status(201).json({ data: await Produto.create(req.body, req.salonId) }); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const p = await Produto.update(req.params.id, req.body, req.salonId);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.patch('/:id/estoque', [body('quantidade').isInt()], validate, async (req, res) => {
  try {
    const p = await Produto.updateEstoque(req.params.id, req.body.quantidade, req.salonId);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const r = await Produto.delete(req.params.id, req.salonId);
    if (!r || r.rowCount === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto excluído com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
