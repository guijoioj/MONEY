# backend/src/routes/fechamentos.js

**Repository:** Desktop
**File:** `backend/src/routes/fechamentos.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/fechamentos.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
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
const Fechamento = require('../models/Fechamento');
const CreditoCliente = require('../models/CreditoCliente');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try { res.json({ data: await Fechamento.getAll(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/em-aberto', async (req, res) => {
  try { res.json({ data: await Fechamento.getEmAberto(req.query, req.salonId) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { clienteId, profissionalId, data, totalAtendimentos, totalVendas, totalProdutos, descontoGeral, totalGeral, formaPagamento, observacoes, atendimentoIds, vendaIds, creditoUtilizado } = req.body;
    if (!(atendimentoIds?.length) && !(vendaIds?.length)) return res.status(400).json({ error: 'Selecione pelo menos um atendimento ou venda' });
    const fechamento = await Fechamento.create({ clienteId, profissionalId, data, totalAtendimentos, totalVendas, totalProdutos, descontoGeral, totalGeral, formaPagamento, observacoes }, atendimentoIds||[], vendaIds||[], req.salonId);
    if (clienteId && creditoUtilizado > 0) {
      await CreditoCliente.create({ clienteId, tipo: 'debito', valor: creditoUtilizado, descricao: 'Débito via fidelidade' }, req.salonId);
    }
    res.status(201).json({ data: fechamento });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const f = await Fechamento.findById(req.params.id, req.salonId);
    if (!f) return res.status(404).json({ error: 'Fechamento não encontrado' });
    res.json(f);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const ok = await Fechamento.delete(req.params.id, req.salonId);
    if (!ok) return res.status(404).json({ error: 'Fechamento não encontrado' });
    res.json({ message: 'Fechamento excluído e itens reabertos' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/:id/estornar', async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo?.trim()) return res.status(400).json({ error: 'Informe o motivo do estorno' });
    const ok = await Fechamento.estornar(req.params.id, motivo, req.salonId);
    if (!ok) return res.status(404).json({ error: 'Fechamento não encontrado' });
    res.json({ message: 'Fechamento estornado com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
```
