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
      query(`
        SELECT s.nome, NULL::text as categoria, COUNT(*)::int as quantidade, COALESCE(SUM(a.valor), 0) as total_gasto
        FROM atendimentos a
        JOIN servicos s ON s.id = a.servico_id
        WHERE a.cliente_id = $1 AND a.salao_id = $2
        GROUP BY s.nome
        ORDER BY quantidade DESC
        LIMIT 5
      `, [cliente.id, req.params.salonId]),
      query(`
        SELECT p.nome, p.categoria, COALESCE(SUM(vi.quantidade), 0)::int as quantidade, COALESCE(SUM(vi.valor_total), 0) as total_gasto
        FROM vendas v
        JOIN venda_itens vi ON vi.venda_id = v.id
        JOIN produtos p ON p.id = vi.produto_id
        WHERE v.cliente_id = $1 AND v.salao_id = $2
        GROUP BY p.nome, p.categoria
        ORDER BY quantidade DESC
        LIMIT 5
      `, [cliente.id, req.params.salonId])
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
      .filter(a => new Date(a.data_hora) >= new Date())
      .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora))[0] || null;

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
