const express = require('express');
const router = express.Router();
const Notificacao = require('../models/Notificacao');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [notificacoes, naoLidas] = await Promise.all([Notificacao.getAll(req.query, req.salonId), Notificacao.countNaoLidas(req.salonId)]);
    res.json({ data: notificacoes, naoLidas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/count', async (req, res) => {
  try { res.json({ naoLidas: await Notificacao.countNaoLidas(req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/gerar-inativos', async (req, res) => {
  try {
    const novas = await Notificacao.gerarNotificacoesClientesInativos(parseInt(req.query.dias)||30, req.salonId);
    const naoLidas = await Notificacao.countNaoLidas(req.salonId);
    res.json({ data: novas, naoLidas, total: novas.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/marcar-todas-lidas', async (req, res) => {
  try { await Notificacao.marcarTodasLidas(req.salonId); res.json({ message: 'Todas marcadas como lidas', naoLidas: 0 }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id/lida', async (req, res) => {
  try {
    const r = await Notificacao.marcarLida(req.params.id, req.salonId);
    if (!r?.rowCount) return res.status(404).json({ error: 'Notificação não encontrada' });
    res.json({ message: 'Marcada como lida', naoLidas: await Notificacao.countNaoLidas(req.salonId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/limpar-lidas', async (req, res) => {
  try { const r = await Notificacao.deleteAllLidas(req.salonId); res.json({ message: 'Lidas excluídas', excluidas: r.rowCount }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const r = await Notificacao.delete(req.params.id, req.salonId);
    if (!r?.rowCount) return res.status(404).json({ error: 'Notificação não encontrada' });
    res.json({ message: 'Excluída', naoLidas: await Notificacao.countNaoLidas(req.salonId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
