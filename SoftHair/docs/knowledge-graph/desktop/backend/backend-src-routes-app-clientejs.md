# backend/src/routes/app/cliente.js

**Repository:** Desktop
**File:** `backend/src/routes/app/cliente.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/app/cliente.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const express = require('express');
const router = express.Router();
const { appAuthMiddleware } = require('../../middleware/appAuth');
const ClienteApp = require('../../models/ClienteApp');
const Cliente = require('../../models/Cliente');
const Fechamento = require('../../models/Fechamento');
const Venda = require('../../models/Venda');
const CreditoCliente = require('../../models/CreditoCliente');
const ClienteHistorico = require('../../models/ClienteHistorico');
const Agendamento = require('../../models/Agendamento');
const { query } = require('../../config/database');

router.use(appAuthMiddleware);

async function resolverCliente(clienteAppId, salonId) {
  const app = await ClienteApp.findById(clienteAppId);
  if (!app) return null;
  const lista = await Cliente.getAll({ search: app.email }, salonId);
  return lista[0] || null;
}

async function resolverOuCriarCliente(clienteAppId, salonId) {
  const app = await ClienteApp.findById(clienteAppId);
  if (!app) return null;
  const lista = await Cliente.getAll({ search: app.email }, salonId);
  if (lista.length) return lista[0];
  return Cliente.create({
    nome: app.nome, email: app.email,
    telefone: app.telefone || '', observacoes: 'Vinculado via app mobile'
  }, salonId);
}

router.get('/perfil/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    const appUser = await ClienteApp.findById(req.clienteApp.clienteAppId);
    res.json({
      appUser: ClienteApp.sanitize(appUser),
      clienteSalao: cliente || null,
      vinculado: !!cliente
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/historico/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: [], message: 'Não cadastrado neste salão ainda' });
    const historico = await ClienteHistorico.getByCliente(cliente.id, req.query, req.params.salonId);
    res.json({ data: historico });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/resumo/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: null, message: 'Não cadastrado neste salão ainda' });
    const resumo = await ClienteHistorico.getResumo(cliente.id, req.params.salonId);
    res.json({ data: resumo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fechamentos/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: [] });
    const fechamentos = await Fechamento.getAll({ clienteId: cliente.id, ...req.query }, req.params.salonId);
    res.json({ data: fechamentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/compras/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: [] });
    const vendas = await Venda.getAll({ clienteId: cliente.id, ...req.query }, req.params.salonId);
    res.json({ data: vendas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/creditos/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: { creditos: [], saldo: 0 } });
    const [creditos, saldo] = await Promise.all([
      CreditoCliente.getByCliente(cliente.id, req.params.salonId),
      CreditoCliente.getSaldo(cliente.id, req.params.salonId)
    ]);
    res.json({ data: { creditos, saldo } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/favoritos/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: { servicos: [], produtos: [] } });
    const [servicos, produtos] = await Promise.all([
      query(`SELECT nome, categoria, quantidade, "totalGasto" FROM cliente_favoritos WHERE "clienteId"=? AND "salonId"=? AND tipo='servico' ORDER BY quantidade DESC LIMIT 5`, [cliente.id, req.params.salonId]),
      query(`SELECT nome, categoria, quantidade, "totalGasto" FROM cliente_favoritos WHERE "clienteId"=? AND "salonId"=? AND tipo='produto' ORDER BY quantidade DESC LIMIT 5`, [cliente.id, req.params.salonId])
    ]);
    res.json({ data: { servicos, produtos } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/agendamentos/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: [] });
    const agendamentos = await Agendamento.getAll({ clienteId: cliente.id }, req.params.salonId);
    res.json({ data: agendamentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/:salonId', async (req, res) => {
  try {
    const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
    if (!cliente) return res.json({ data: null });

    const [resumo, saldo, proximosAgendamentos] = await Promise.all([
      ClienteHistorico.getResumo(cliente.id, req.params.salonId),
      CreditoCliente.getSaldo(cliente.id, req.params.salonId),
      Agendamento.getAll({ clienteId: cliente.id, status: 'agendado' }, req.params.salonId)
    ]);

    const proximoAgendamento = proximosAgendamentos
      .filter(a => new Date(a.dataHora) >= new Date())
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))[0] || null;

    res.json({
      data: {
        totalAtendimentos: resumo.totalAtendimentos,
        totalGastoServicos: resumo.totalGastoServicos,
        totalGastoProdutos: resumo.totalGastoProdutos,
        saldoCredito: saldo,
        servicosFavoritos: resumo.servicosFavoritos.slice(0, 3),
        produtosFavoritos: resumo.produtosFavoritos.slice(0, 3),
        proximoAgendamento
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```
