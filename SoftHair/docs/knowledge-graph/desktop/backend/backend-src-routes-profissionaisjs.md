# backend/src/routes/profissionais.js

**Repository:** Desktop
**File:** `backend/src/routes/profissionais.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/profissionais.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/profissionais|profissionais]]
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
const router = express.Router();
const Profissional = require('../models/Profissional');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try { res.json({ data: await Profissional.getAll(req.query, req.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const p = await Profissional.findById(req.params.id, req.salonId);
    if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json({ data: p });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    if (!req.body.nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    res.status(201).json({ data: await Profissional.create(req.body, req.salonId) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const p = await Profissional.update(req.params.id, req.body, req.salonId);
    if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const r = await Profissional.delete(req.params.id, req.salonId);
    if (!r || r.rowCount === 0) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json({ message: 'Profissional excluído com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
```
