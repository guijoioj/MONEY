const express = require('express');
const router = express.Router();
const PedidoAgendamento = require('../../models/PedidoAgendamento');
const Agendamento = require('../../models/Agendamento');
const Salao = require('../../models/Salao');
const Servico = require('../../models/Servico');
const Profissional = require('../../models/Profissional');
const ClienteApp = require('../../models/ClienteApp');
const Cliente = require('../../models/Cliente');
const { appAuthMiddleware } = require('../../middleware/appAuth');
const { authMiddleware } = require('../../middleware/auth');
const ws = require('../../services/websocketService');

async function resolverOuCriarCliente(clienteAppId, salonId) {
  const clienteApp = await ClienteApp.findById(clienteAppId);
  if (!clienteApp) return null;
  if (clienteApp.email) {
    const existentes = await Cliente.getAll({ search: clienteApp.email }, salonId);
    if (existentes.length) return existentes[0].id;
  }
  const novo = await Cliente.create({
    nome: clienteApp.nome,
    email: clienteApp.email || null,
    telefone: clienteApp.telefone || '',
    observacoes: 'Vinculado via app mobile'
  }, salonId);
  return novo?.id ?? null;
}

router.get('/saloes', async (req, res) => {
  try { res.json({ data: await Salao.getAll(req.query) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/saloes/:salonId/servicos', async (req, res) => {
  try { res.json({ data: await Servico.getAll({ ativo: true }, req.params.salonId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/saloes/:salonId/profissionais', async (req, res) => {
  try {
    const profissionais = await Profissional.getAll({ ativo: true }, req.params.salonId);
    const { data, horario, servicoId } = req.query;
    if (!data || !horario) return res.json({ data: profissionais });
    let duracao = 30;
    if (servicoId) {
      const servico = await Servico.findById(servicoId, req.params.salonId);
    if (servico) duracao = servico.duracao_minutos || 30;
    }
    const dataHora = `${data}T${horario}`;
    const resultado = await Promise.all(
      profissionais.map(async (prof) => {
        const disp = await Agendamento.verificarDisponibilidade(prof.id, dataHora, duracao, req.params.salonId);
        return { ...prof, disponivel: disp.disponivel };
      })
    );
    res.json({ data: resultado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', appAuthMiddleware, async (req, res) => {
  try {
    const { salonId, servicoId, profissionalId, dataDesejada, horarioDesejado, horarioAlternativo, observacoes } = req.body;
    if (!salonId || !servicoId || !dataDesejada || !horarioDesejado) {
      return res.status(400).json({ error: 'salonId, servicoId, dataDesejada e horarioDesejado são obrigatórios' });
    }
    const pedido = await PedidoAgendamento.create({
      salonId, clienteAppId: req.clienteApp.clienteAppId,
      servicoId, profissionalId, dataDesejada, horarioDesejado, horarioAlternativo, observacoes
    });

    ws.notificarSalao(salonId, {
      tipo: 'novo_pedido_agendamento',
      titulo: 'Novo pedido de agendamento',
      mensagem: `${req.clienteApp.nome} quer agendar para ${dataDesejada} às ${horarioDesejado}`,
      pedido
    });

    res.status(201).json(pedido);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/meus', appAuthMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoAgendamento.getByCliente(req.clienteApp.clienteAppId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/salao', authMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoAgendamento.getBySalao(req.salaoId, req.query) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/aprovar', authMiddleware, async (req, res) => {
  try {
    const { profissionalId, dataHora } = req.body;
    const pedido = await PedidoAgendamento.findById(req.params.id);
    if (!pedido || Number(pedido.salonId) !== Number(req.salaoId)) return res.status(404).json({ error: 'Pedido não encontrado' });

    const clienteId = await resolverOuCriarCliente(pedido.clienteAppId, req.salaoId);
    const agendamento = await Agendamento.create({
      clienteId,
      servicoId: pedido.servicoId,
      profissionalId: profissionalId || pedido.profissionalId,
      dataHora: dataHora || `${pedido.dataDesejada}T${pedido.horarioDesejado}`,
      status: 'agendado',
      observacoes: pedido.observacoes
    }, req.salaoId);

    const pedidoAtualizado = await PedidoAgendamento.aprovar(req.params.id, req.salaoId, agendamento.id, req.user.id);

    ws.notificarCliente(pedido.clienteAppId, {
      tipo: 'pedido_aprovado',
      titulo: 'Agendamento aprovado!',
      mensagem: `Seu agendamento para ${pedido.dataDesejada} às ${pedido.horarioDesejado} foi confirmado`,
      pedido: pedidoAtualizado
    });

    if (profissionalId || pedido.profissionalId) {
      const profId = profissionalId || pedido.profissionalId;
      ws.notificarProfissional(profId, {
        tipo: 'novo_agendamento',
        titulo: 'Novo agendamento',
        mensagem: `${pedido.clienteNome} agendou ${pedido.servicoNome} para ${pedido.dataDesejada} às ${pedido.horarioDesejado}`,
        agendamento
      });
    }

    res.json(pedidoAtualizado);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/:id/verificar-disponibilidade', authMiddleware, async (req, res) => {
  try {
    const pedido = await PedidoAgendamento.findById(req.params.id);
    if (!pedido || Number(pedido.salonId) !== Number(req.salaoId)) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!pedido.profissionalId) return res.json({ disponivel: true, semProfissional: true });
    const dataHora = `${pedido.dataDesejada}T${pedido.horarioDesejado}`;
    const duracao = pedido.servicoDuracao || 30;
    const resultado = await Agendamento.verificarDisponibilidade(pedido.profissionalId, dataHora, duracao, req.salaoId);
    res.json(resultado);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/proximo-horario', authMiddleware, async (req, res) => {
  try {
    const pedido = await PedidoAgendamento.findById(req.params.id);
    if (!pedido || Number(pedido.salonId) !== Number(req.salaoId)) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!pedido.profissionalId) return res.status(400).json({ error: 'Nenhum profissional específico solicitado' });
    const dataHora = `${pedido.dataDesejada}T${pedido.horarioDesejado}`;
    const duracao = pedido.servicoDuracao || 30;
    const proximo = await Agendamento.proximoHorarioVago(pedido.profissionalId, dataHora, duracao, req.salaoId);
    if (!proximo) return res.status(404).json({ error: 'Nenhum horário disponível encontrado' });
    res.json({ dataHora: proximo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/rejeitar', authMiddleware, async (req, res) => {
  try {
    const { motivo } = req.body;
    const pedido = await PedidoAgendamento.findById(req.params.id);
    if (!pedido || Number(pedido.salonId) !== Number(req.salaoId)) return res.status(404).json({ error: 'Pedido não encontrado' });
    const pedidoAtualizado = await PedidoAgendamento.rejeitar(req.params.id, req.salaoId, motivo);
    ws.notificarCliente(pedido.clienteAppId, {
      tipo: 'pedido_rejeitado',
      titulo: 'Agendamento não disponível',
      mensagem: motivo || 'Seu pedido de agendamento não pôde ser confirmado',
      pedido: pedidoAtualizado
    });
    res.json(pedidoAtualizado);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
