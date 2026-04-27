# backend/src/routes/atendimentos.js

**Repository:** Desktop
**File:** `backend/src/routes/atendimentos.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/atendimentos.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
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
const Atendimento = require('../models/Atendimento');
const Venda = require('../models/Venda');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try { res.json({ data: await Atendimento.getAll(req.query, req.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/fechamento', async (req, res) => {
  try {
    const { clienteId, profissionalId, data, horaInicio, horaFim, desconto, observacoes, totalProdutos, totalServicos, totalGeral, formaPagamento, produtos, servicos, incluirVenda, vendedorId, produtosVendidos, totalVenda } = req.body;
    const atendimento = await Atendimento.create({ clienteId, profissionalId, data, horaInicio, horaFim, desconto, observacoes, totalProdutos, totalServicos, totalGeral, formaPagamento }, produtos||[], servicos||[], req.salonId);
    let venda = null;
    if (incluirVenda && produtosVendidos?.length) {
      venda = await Venda.create({ clienteId: clienteId||null, vendedorId: vendedorId||null, data, total: totalVenda||0, formaPagamento, atendimentoId: atendimento.id }, produtosVendidos, req.salonId);
    }
    res.status(201).json({ data: { atendimento, venda } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const a = await Atendimento.findById(req.params.id, req.salonId);
    if (!a) return res.status(404).json({ error: 'Atendimento não encontrado' });
    res.json({ data: a });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { clienteId, profissionalId, auxiliarId, data, horaInicio, horaFim, desconto, observacoes, totalProdutos, totalServicos, totalGeral, produtos, servicos } = req.body;
    res.status(201).json(await Atendimento.create({ clienteId, profissionalId, auxiliarId, data, horaInicio, horaFim, desconto, observacoes, totalProdutos, totalServicos, totalGeral }, produtos||[], servicos||[], req.salonId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const { clienteId, profissionalId, auxiliarId, data, horaInicio, horaFim, desconto, observacoes, totalProdutos, totalServicos, totalGeral, produtos, servicos } = req.body;
    const a = await Atendimento.update(req.params.id, { clienteId, profissionalId, auxiliarId, data, horaInicio, horaFim, desconto, observacoes, totalProdutos, totalServicos, totalGeral }, produtos||[], servicos||[], req.salonId);
    if (!a) return res.status(404).json({ error: 'Atendimento não encontrado' });
    res.json({ data: a });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const r = await Atendimento.delete(req.params.id, req.salonId);
    if (!r || r.rowCount === 0) return res.status(404).json({ error: 'Atendimento não encontrado' });
    res.json({ message: 'Atendimento excluído com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
```
