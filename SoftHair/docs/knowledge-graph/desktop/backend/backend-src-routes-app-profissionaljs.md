# backend/src/routes/app/profissional.js

**Repository:** Desktop
**File:** `backend/src/routes/app/profissional.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/app/profissional.js` do repositório Desktop.

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
const Agendamento = require('../../models/Agendamento');
const Atendimento = require('../../models/Atendimento');
const Venda = require('../../models/Venda');
const Fechamento = require('../../models/Fechamento');
const PontoRegistro = require('../../models/PontoRegistro');
const ComissaoPaga = require('../../models/ComissaoPaga');
const Cliente = require('../../models/Cliente');
const ClienteHistorico = require('../../models/ClienteHistorico');
const CreditoCliente = require('../../models/CreditoCliente');
const { profissionalAppMiddleware } = require('../../middleware/appAuth');
const { queryOne, query } = require('../../config/database');
const ws = require('../../services/websocketService');

router.use(profissionalAppMiddleware);

function checkProfissional(req, res) {
  if (!req.profissionalId) {
    res.status(403).json({ error: 'Acesso restrito a profissionais' });
    return false;
  }
  return true;
}

router.get('/perfil', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const profissional = await queryOne('SELECT * FROM profissionais WHERE id=? AND "salonId"=?', [req.profissionalId, req.salonId]);
    if (!profissional) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json(profissional);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const hoje = new Date().toISOString().split('T')[0];

    const [agendamentosHoje, atendimentosHoje, pontoHoje, comissoesPendentes] = await Promise.all([
      Agendamento.getAll({ profissionalId: req.profissionalId, data: hoje }, req.salonId),
      Atendimento.getAll({ profissionalId: req.profissionalId, data: hoje, comServicos: true }, req.salonId),
      PontoRegistro.getResumoHoje(req.profissionalId, req.salonId),
      query(`
        SELECT COALESCE(SUM(f."totalAtendimentos" * (p.comissao/100.0)), 0) as pendente
        FROM fechamentos f
        JOIN profissionais p ON p.id = f."profissionalId"
        LEFT JOIN comissoes_pagas cp ON cp."fechamentoId" = f.id AND cp."profissionalId" = f."profissionalId"
        WHERE f."profissionalId" = ? AND f."salonId" = ? AND cp.id IS NULL
      `, [req.profissionalId, req.salonId])
    ]);

    const receitaHoje = atendimentosHoje.reduce((s, a) => s + (a.totalGeral || 0), 0);
    const comissaoPct = parseFloat(atendimentosHoje[0]?.profissionalComissao) || 0;
    const comissaoHoje = receitaHoje * (comissaoPct / 100);

    res.json({
      data: {
        agendamentosHoje: agendamentosHoje.length,
        atendimentosRealizados: atendimentosHoje.length,
        receitaHoje,
        comissaoHoje,
        comissaoPendente: parseFloat(comissoesPendentes[0]?.pendente || 0),
        estaBatendoPonto: !!pontoHoje.entrada && !pontoHoje.saida,
        horasTrabalhadas: pontoHoje.horasTrabalhadas
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/agenda', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const { data } = req.query;
    const agendamentos = await Agendamento.getAll(
      { profissionalId: req.profissionalId, data: data || new Date().toISOString().split('T')[0] },
      req.salonId
    );
    res.json({ data: agendamentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/atendimentos', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const atendimentos = await Atendimento.getAll(
      { profissionalId: req.profissionalId, ...req.query, comServicos: true },
      req.salonId
    );
    res.json({ data: atendimentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/atendimentos/:id', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const atendimento = await Atendimento.findById(req.params.id, req.salonId);
    if (!atendimento || atendimento.profissionalId !== req.profissionalId) {
      return res.status(404).json({ error: 'Atendimento não encontrado' });
    }
    let clienteInfo = null;
    if (atendimento.clienteId) {
      const [cliente, resumo, saldo] = await Promise.all([
        Cliente.findById(atendimento.clienteId, req.salonId),
        ClienteHistorico.getResumo(atendimento.clienteId, req.salonId),
        CreditoCliente.getSaldo(atendimento.clienteId, req.salonId)
      ]);
      clienteInfo = { ...cliente, resumo, saldo };
    }
    res.json({ ...atendimento, clienteInfo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/atendimentos/:id/iniciar', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const atendimento = await Atendimento.findById(req.params.id, req.salonId);
    if (!atendimento || atendimento.profissionalId !== req.profissionalId) {
      return res.status(404).json({ error: 'Atendimento não encontrado' });
    }
    const horaInicio = new Date().toTimeString().slice(0, 5);
    const atendimentoAtualizado = await Atendimento.update(
      req.params.id,
      { ...atendimento, horaInicio, status: 'em_andamento' },
      atendimento.produtos || [],
      atendimento.servicos || [],
      req.salonId
    );

    const ponto = await PontoRegistro.registrar({
      salonId: req.salonId, profissionalId: req.profissionalId,
      tipo: 'inicio_atendimento', atendimentoId: req.params.id
    });

    ws.notificarSalao(req.salonId, {
      tipo: 'atendimento_iniciado',
      titulo: 'Atendimento iniciado',
      mensagem: `${req.user.name} iniciou atendimento${atendimento.clienteNome ? ' de ' + atendimento.clienteNome : ''}`,
      atendimentoId: req.params.id, profissionalId: req.profissionalId
    });

    if (atendimento.clienteId) {
      const clienteApp = await query(
        'SELECT ca.id FROM clientes_app ca JOIN clientes c ON ca.email = c.email WHERE c.id = ?',
        [atendimento.clienteId]
      );
      if (clienteApp.length) {
        ws.notificarCliente(clienteApp[0].id, {
          tipo: 'atendimento_iniciado',
          titulo: 'Seu atendimento começou!',
          mensagem: `${req.user.name} iniciou seu atendimento`,
          atendimentoId: req.params.id
        });
      }
    }

    res.json({ atendimento: atendimentoAtualizado, ponto });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/atendimentos/:id/finalizar', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const atendimento = await Atendimento.findById(req.params.id, req.salonId);
    if (!atendimento || atendimento.profissionalId !== req.profissionalId) {
      return res.status(404).json({ error: 'Atendimento não encontrado' });
    }
    const horaFim = new Date().toTimeString().slice(0, 5);
    const atendimentoAtualizado = await Atendimento.update(
      req.params.id,
      { ...atendimento, horaFim, status: 'finalizado' },
      atendimento.produtos || [],
      atendimento.servicos || [],
      req.salonId
    );

    const ponto = await PontoRegistro.registrar({
      salonId: req.salonId, profissionalId: req.profissionalId,
      tipo: 'fim_atendimento', atendimentoId: req.params.id
    });

    ws.notificarSalao(req.salonId, {
      tipo: 'atendimento_finalizado',
      titulo: 'Atendimento finalizado',
      mensagem: `${req.user.name} finalizou atendimento${atendimento.clienteNome ? ' de ' + atendimento.clienteNome : ''}`,
      atendimentoId: req.params.id
    });

    res.json({ atendimento: atendimentoAtualizado, ponto });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/vendas', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const vendas = await Venda.getAll({ vendedorId: req.profissionalId, ...req.query }, req.salonId);
    res.json({ data: vendas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fechamentos', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const fechamentos = await Fechamento.getAll({ profissionalId: req.profissionalId, ...req.query }, req.salonId);
    res.json({ data: fechamentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/historico-financeiro', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const { dataInicio, dataFim } = req.query;
    const hoje = new Date().toISOString().split('T')[0];
    const inicio = dataInicio || new Date(new Date().setDate(1)).toISOString().split('T')[0];
    const fim = dataFim || hoje;

    const [atendimentos, comissoesPagas, totalComissaoPaga] = await Promise.all([
      Atendimento.getAll({ profissionalId: req.profissionalId, dataInicio: inicio, dataFim: fim, comServicos: true }, req.salonId),
      ComissaoPaga.getAll({ profissionalId: req.profissionalId, dataInicio: inicio, dataFim: fim }, req.salonId),
      ComissaoPaga.getTotalPago(req.profissionalId, req.salonId)
    ]);

    const receita = atendimentos.reduce((s, a) => s + (a.totalGeral || 0), 0);
    const comissaoPct = atendimentos[0]?.profissionalComissao || 0;
    const comissaoTotal = receita * (comissaoPct / 100);

    res.json({
      data: {
        periodo: { inicio, fim },
        atendimentos: atendimentos.length,
        receita,
        comissaoPercentual: comissaoPct,
        comissaoValor: comissaoTotal,
        comissaoJaPaga: totalComissaoPaga,
        comissaoPendente: Math.max(0, comissaoTotal - totalComissaoPaga),
        detalhe: atendimentos
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/clientes', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const clientesAtendidos = await query(`
      SELECT DISTINCT c.id, c.nome, c.telefone, c.email,
             MAX(a.data) as "ultimaVisita",
             COUNT(a.id) as "totalAtendimentos"
      FROM atendimentos a
      JOIN clientes c ON a."clienteId" = c.id
      WHERE a."profissionalId" = ? AND a."salonId" = ? AND a."clienteId" IS NOT NULL
      GROUP BY c.id, c.nome, c.telefone, c.email
      ORDER BY "ultimaVisita" DESC
    `, [req.profissionalId, req.salonId]);
    res.json({ data: clientesAtendidos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/clientes/:clienteId', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const [cliente, resumo, saldo, agendamentos] = await Promise.all([
      Cliente.findById(req.params.clienteId, req.salonId),
      ClienteHistorico.getResumo(req.params.clienteId, req.salonId),
      CreditoCliente.getSaldo(req.params.clienteId, req.salonId),
      Agendamento.getAll({ clienteId: req.params.clienteId, status: 'agendado' }, req.salonId)
    ]);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ cliente, resumo, saldo, proximosAgendamentos: agendamentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ponto', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const { tipo, atendimentoId, observacoes } = req.body;
    const tiposValidos = ['entrada', 'saida', 'inicio_atendimento', 'fim_atendimento', 'pausa', 'retorno_pausa'];
    if (!tiposValidos.includes(tipo)) return res.status(400).json({ error: `Tipo inválido: ${tiposValidos.join(', ')}` });

    const registro = await PontoRegistro.registrar({
      salonId: req.salonId, profissionalId: req.profissionalId, tipo, atendimentoId, observacoes
    });

    ws.notificarSalao(req.salonId, {
      tipo: 'ponto_registrado',
      titulo: 'Ponto registrado',
      mensagem: `${req.user.name || 'Profissional'} registrou: ${tipo.replace(/_/g, ' ')}`,
      registro
    });

    res.status(201).json(registro);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/ponto', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    res.json({ data: await PontoRegistro.getResumoHoje(req.profissionalId, req.salonId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ponto/historico', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    res.json({ data: await PontoRegistro.getByProfissional(req.profissionalId, req.salonId, req.query.data) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/comissoes', async (req, res) => {
  try {
    if (!checkProfissional(req, res)) return;
    const [comissoes, total] = await Promise.all([
      ComissaoPaga.getAll({ profissionalId: req.profissionalId }, req.salonId),
      ComissaoPaga.getTotalPago(req.profissionalId, req.salonId)
    ]);
    res.json({ data: comissoes, totalPago: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/aviso-atraso', async (req, res) => {
  try {
    const { agendamentoId, mensagem } = req.body;
    ws.notificarSalao(req.salonId, {
      tipo: 'aviso_atraso_profissional',
      titulo: 'Aviso de atraso',
      mensagem: mensagem || `${req.user.name} avisou que vai se atrasar`,
      profissionalId: req.profissionalId, agendamentoId
    });
    if (agendamentoId) {
      const agendamento = await Agendamento.findById(agendamentoId, req.salonId);
      if (agendamento?.clienteId) {
        const clienteApp = await query(
          'SELECT ca.id FROM clientes_app ca JOIN clientes c ON ca.email = c.email WHERE c.id = ?',
          [agendamento.clienteId]
        );
        if (clienteApp.length) {
          ws.notificarCliente(clienteApp[0].id, {
            tipo: 'profissional_atrasado',
            titulo: 'Profissional atrasado',
            mensagem: mensagem || `${req.user.name} vai se atrasar um pouco`,
            agendamentoId
          });
        }
      }
    }
    res.json({ message: 'Aviso enviado' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
```
