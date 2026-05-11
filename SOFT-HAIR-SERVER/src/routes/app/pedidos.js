const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
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

// [P2-A1/P2-A2] Rate-limit para endpoints públicos (enumeração de salões + DoS por disponibilidade)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// [P2-A1/P2-B4] Filtra campos públicos do salão (sem email/telefone/cnpj internos)
function sanitizeSalaoPublico(s) {
  if (!s) return s;
  return {
    id: s.id,
    nome: s.nome,
    endereco: s.endereco,
    cidade: s.cidade,
    estado: s.estado,
    foto_url: s.foto_url,
    descricao: s.descricao,
    ativo: s.ativo,
  };
}

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

// [P3-A5] Verifica se cliente já tem vínculo (registro Cliente) no salão. Permite criar pedido
// apenas em salões onde já está vinculado, evitando spam cross-tenant. Match exato por email.
async function clienteJaVinculado(clienteAppId, salonId) {
  try {
    const clienteApp = await ClienteApp.findById(clienteAppId);
    if (!clienteApp) return false;
    const { queryOne } = require('../../config/database');
    if (clienteApp.email) {
      const row = await queryOne(
        'SELECT 1 FROM clientes WHERE LOWER(email) = LOWER($1) AND salao_id = $2 LIMIT 1',
        [clienteApp.email, salonId]
      );
      if (row) return true;
    }
    if (clienteApp.telefone) {
      const row = await queryOne(
        'SELECT 1 FROM clientes WHERE telefone = $1 AND salao_id = $2 LIMIT 1',
        [clienteApp.telefone, salonId]
      );
      if (row) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// [P2-A1] Lista de salões: campos limitados + rate-limit (impede enumeração/dump)
router.get('/saloes', publicLimiter, async (req, res) => {
  try {
    const saloes = await Salao.getAll(req.query);
    res.json({ data: (saloes || []).map(sanitizeSalaoPublico) });
  } catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// [P2-A2] Serviços públicos: rate-limit + campos seguros (já só Servico ativo)
router.get('/saloes/:salonId/servicos', publicLimiter, async (req, res) => {
  try {
    const servicos = await Servico.getAll({ ativo: true }, req.params.salonId);
    const publicos = (servicos || []).map(s => ({
      id: s.id, nome: s.nome, descricao: s.descricao,
      preco: s.preco, duracao_minutos: s.duracao_minutos, cor: s.cor,
      ativo: s.ativo
    }));
    res.json({ data: publicos });
  } catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// [P2-A2] Profissionais públicos: rate-limit; verificação de disponibilidade só com
// data+horario (curtinho); campos limitados (sem cpf/comissão).
router.get('/saloes/:salonId/profissionais', publicLimiter, async (req, res) => {
  try {
    const profissionais = await Profissional.getAll({ ativo: true }, req.params.salonId);
    const { data, horario, servicoId } = req.query;
    const publicos = (profissionais || []).map(p => ({
      id: p.id, nome: p.nome, especialidade: p.especialidade,
      foto_url: p.foto_url, ativo: p.ativo,
    }));
    if (!data || !horario) return res.json({ data: publicos });
    let duracao = 30;
    if (servicoId) {
      const servico = await Servico.findById(servicoId, req.params.salonId);
      if (servico) duracao = servico.duracao_minutos || 30;
    }
    const dataHora = `${data}T${horario}`;
    const resultado = await Promise.all(
      publicos.map(async (prof) => {
        const disp = await Agendamento.verificarDisponibilidade(prof.id, dataHora, duracao, req.params.salonId);
        return { ...prof, disponivel: disp.disponivel };
      })
    );
    res.json({ data: resultado });
  } catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

router.post('/', appAuthMiddleware, async (req, res) => {
  try {
    const { salonId, servicoId, profissionalId, dataDesejada, horarioDesejado, horarioAlternativo, observacoes } = req.body;
    if (!salonId || !servicoId || !dataDesejada || !horarioDesejado) {
      return res.status(400).json({ error: 'salonId, servicoId, dataDesejada e horarioDesejado são obrigatórios' });
    }

    // [P3-A5] Cliente só pode criar pedido em salão onde já existe vínculo (cliente registrado).
    // Evita spam cross-tenant — cliente do salão A não pode bombardear salão B com pedidos falsos.
    const vinculado = await clienteJaVinculado(req.clienteApp.clienteAppId, salonId);
    if (!vinculado) {
      return res.status(403).json({ error: 'Você ainda não está vinculado a este salão. Cadastre-se ou faça o primeiro contato presencial.' });
    }

    // [P2-M6] Validar que servicoId e profissionalId pertencem ao salonId (cross-tenant)
    const { queryOne } = require('../../config/database');
    const servicoOk = await queryOne('SELECT 1 FROM servicos WHERE id = $1 AND salao_id = $2 AND ativo = true', [servicoId, salonId]);
    if (!servicoOk) return res.status(400).json({ error: 'Serviço não pertence ao salão' });
    if (profissionalId) {
      const profOk = await queryOne('SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2 AND ativo = true', [profissionalId, salonId]);
      if (!profOk) return res.status(400).json({ error: 'Profissional não pertence ao salão' });
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
  } catch (e) { require("../../utils/sendError").sendError(res, 400, "Requisição inválida", e); }
});

router.get('/meus', appAuthMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoAgendamento.getByCliente(req.clienteApp.clienteAppId) }); }
  catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

router.get('/salao', authMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoAgendamento.getBySalao(req.salaoId, req.query) }); }
  catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
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

    // [P5-M6] req.user.id NÃO existe — JWT usa userId. Fallback compatível.
    const aprovadoPorId = req.user?.userId || req.user?.id || null;
    const pedidoAtualizado = await PedidoAgendamento.aprovar(req.params.id, req.salaoId, agendamento.id, aprovadoPorId);

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
  } catch (e) { require("../../utils/sendError").sendError(res, 400, "Requisição inválida", e); }
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
  } catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
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
  } catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
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
  } catch (e) { require("../../utils/sendError").sendError(res, 400, "Requisição inválida", e); }
});

module.exports = router;
