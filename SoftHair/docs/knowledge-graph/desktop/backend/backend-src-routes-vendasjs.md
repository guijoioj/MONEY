# backend/src/routes/vendas.js

**Repository:** Desktop
**File:** `backend/src/routes/vendas.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/vendas.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/vendas|vendas]]
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
const Venda = require('../models/Venda');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try { res.json({ data: await Venda.getAll(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/estatisticas', async (req, res) => {
  try { res.json({ data: await Venda.getEstatisticas(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const v = await Venda.findById(req.params.id, req.salonId);
    if (!v) return res.status(404).json({ error: 'Venda não encontrada' });
    res.json({ data: v });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', [body('total').isFloat({ min: 0 }), body('itens').isArray({ min: 1 })], validate, async (req, res) => {
  try {
    const { clienteId, vendedorId, data, total, formaPagamento, observacoes, itens } = req.body;
    res.status(201).json(await Venda.create({ clienteId, vendedorId, data, total, formaPagamento, observacoes }, itens, req.salonId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', [body('itens').isArray({ min: 1 })], validate, async (req, res) => {
  try {
    const { clienteId, vendedorId, data, formaPagamento, observacoes, itens } = req.body;
    const v = await Venda.update(req.params.id, { clienteId, vendedorId, data, formaPagamento, observacoes }, itens, req.salonId);
    if (!v) return res.status(404).json({ error: 'Venda não encontrada' });
    res.json(v);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const ok = await Venda.delete(req.params.id, req.salonId);
    if (!ok) return res.status(404).json({ error: 'Venda não encontrada' });
    res.json({ message: 'Venda excluída com sucesso' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```
