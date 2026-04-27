# backend/src/routes/agendamentos.js

**Repository:** Desktop
**File:** `backend/src/routes/agendamentos.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/agendamentos.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/servicos|servicos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Agendamento = require('../models/Agendamento');
const PedidoAgendamento = require('../models/PedidoAgendamento');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try { res.json({ data: await Agendamento.getAll(req.query, req.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/proximos', async (req, res) => {
  try { res.json({ data: await Agendamento.getProximos(parseInt(req.query.dias||7), req.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/pendentes', async (req, res) => {
  try { res.json({ data: await Agendamento.getPendentesConversao(req.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/solicitacoes', async (req, res) => {
  try { res.json({ data: await PedidoAgendamento.getBySalao(req.salonId, req.query) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/converter/:id', async (req, res) => {
  try {
    const r = await Agendamento.converterParaAtendimento(req.params.id, req.salonId);
    if (!r) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ data: r });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/converter-todos', async (req, res) => {
  try {
    const pendentes = await Agendamento.getPendentesConversao(req.salonId);
    const resultados = [];
    for (const a of pendentes) {
      const r = await Agendamento.converterParaAtendimento(a.id, req.salonId);
      if (r) resultados.push(r);
    }
    res.json({ message: `${resultados.length} agendamento(s) convertido(s)`, resultados });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const a = await Agendamento.findById(req.params.id, req.salonId);
    if (!a) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ data: a });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', [
  body('clienteId').notEmpty(), body('servicoId').notEmpty(), body('dataHora').notEmpty(),
], validate, async (req, res) => {
  try { res.status(201).json(await Agendamento.create(req.body, req.salonId)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const a = await Agendamento.update(req.params.id, req.body, req.salonId);
    if (!a) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(a);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const r = await Agendamento.delete(req.params.id, req.salonId);
    if (!r || r.rowCount === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ message: 'Agendamento excluído com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
```
