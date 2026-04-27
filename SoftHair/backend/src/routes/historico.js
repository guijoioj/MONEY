const express = require('express');
const router = express.Router();
const ClienteHistorico = require('../models/ClienteHistorico');
const Cliente = require('../models/Cliente');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/cliente/:id/resumo', async (req, res) => {
  try {
    const [cliente, resumo] = await Promise.all([Cliente.findById(req.params.id, req.salonId), ClienteHistorico.getResumo(req.params.id, req.salonId)]);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ data: { cliente, resumo } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/cliente/:id/historico', async (req, res) => {
  try { res.json({ data: await ClienteHistorico.getByCliente(req.params.id, req.query, req.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cliente/:id/historico', async (req, res) => {
  try {
    const { tipo, descricao, entidadeId, data } = req.body;
    if (!tipo || !descricao) return res.status(400).json({ error: 'tipo e descricao obrigatórios' });
    res.status(201).json(await ClienteHistorico.create({ clienteId: req.params.id, tipo, descricao, entidadeId, data }, req.salonId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
