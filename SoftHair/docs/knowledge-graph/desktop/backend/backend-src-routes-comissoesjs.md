# backend/src/routes/comissoes.js

**Repository:** Desktop
**File:** `backend/src/routes/comissoes.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/comissoes.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/profissionais|profissionais]]
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
const router = express.Router();
const ComissaoPaga = require('../models/ComissaoPaga');
const ComissaoEstorno = require('../models/ComissaoEstorno');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/pagas', async (req, res) => {
  try { res.json({ data: await ComissaoPaga.getAll(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/estornos', async (req, res) => {
  try { res.json({ data: await ComissaoEstorno.getAll(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/pagar', async (req, res) => {
  try {
    const { profissionalId, fechamentoId, valor, dataPagamento, observacoes } = req.body;
    if (!profissionalId || !valor) return res.status(400).json({ error: 'Informe profissionalId e valor' });
    res.status(201).json(await ComissaoPaga.create({ profissionalId, fechamentoId, valor, dataPagamento, observacoes }, req.salonId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/estornar', async (req, res) => {
  try {
    const { comissaoPagaId, profissionalId, valor, motivo } = req.body;
    if (!comissaoPagaId) return res.status(400).json({ error: 'comissaoPagaId obrigatório' });
    if (!profissionalId || !valor || !motivo) return res.status(400).json({ error: 'Informe profissionalId, valor e motivo' });
    res.status(201).json(await ComissaoEstorno.create({ comissaoPagaId, profissionalId, valor, motivo }, req.salonId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/pagas/:id', async (req, res) => {
  try { await ComissaoPaga.delete(req.params.id, req.salonId); res.json({ message: 'Excluído' }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
```
