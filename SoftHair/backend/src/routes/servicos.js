const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Servico = require('../models/Servico');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [servicos, categorias] = await Promise.all([Servico.getAll(req.query, req.salonId), Servico.getCategorias(req.salonId)]);
    res.json({ data: servicos, categorias });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/categorias', async (req, res) => {
  try { res.json(await Servico.getCategorias(req.salonId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const s = await Servico.findById(req.params.id, req.salonId);
    if (!s) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json({ data: s });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', [
  body('nome').trim().notEmpty(), body('duracao').isInt({ min: 1 }), body('preco').isFloat({ min: 0 }),
], validate, async (req, res) => {
  try { res.status(201).json({ data: await Servico.create(req.body, req.salonId) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const s = await Servico.update(req.params.id, req.body, req.salonId);
    if (!s) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json(s);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const r = await Servico.delete(req.params.id, req.salonId);
    if (!r || r.rowCount === 0) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json({ message: 'Serviço excluído com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
