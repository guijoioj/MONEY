const express = require('express');
const router = express.Router();
const CreditoCliente = require('../models/CreditoCliente');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try { res.json({ data: await CreditoCliente.getAll(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/saldo/:clienteId', async (req, res) => {
  try { res.json({ data: { clienteId: req.params.clienteId, saldo: await CreditoCliente.getSaldo(req.params.clienteId, req.salonId) } }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/cliente/:clienteId', async (req, res) => {
  try {
    const [creditos, saldo] = await Promise.all([CreditoCliente.getByCliente(req.params.clienteId, req.salonId), CreditoCliente.getSaldo(req.params.clienteId, req.salonId)]);
    res.json({ data: { creditos, saldo } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/todos-com-saldo', async (req, res) => {
  try { res.json({ data: await CreditoCliente.getAllWithSaldo(req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { clienteId, tipo, valor, descricao } = req.body;
    if (!clienteId || !tipo || !valor) return res.status(400).json({ error: 'Informe clienteId, tipo e valor' });
    if (!['credito','debito'].includes(tipo)) return res.status(400).json({ error: 'Tipo deve ser credito ou debito' });
    res.status(201).json({ data: await CreditoCliente.create({ clienteId, tipo, valor, descricao }, req.salonId) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try { await CreditoCliente.delete(req.params.id, req.salonId); res.json({ message: 'Crédito excluído' }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
