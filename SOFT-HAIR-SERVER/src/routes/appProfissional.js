const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { sendPush } = require('../services/pushService');
const { AgendamentoService, AtendimentoService } = require('../services');
const { logAction } = require('../utils/auditLog');

const agendamentoService = new AgendamentoService();
const atendimentoService = new AtendimentoService();

// [P5-M3] Rate limit por profissional+IP: 10 pontos/min — bloqueia double-clicks e abuse.
const pontoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Muitas requisições de ponto. Aguarde um momento.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.profissionalId || 'anon'}|${req.ip || 'unknown'}`,
  skip: () => process.env.NODE_ENV === 'test',
});

const TIPOS_PONTO = ['entrada', 'saida', 'pausa', 'retorno_pausa', 'inicio_atendimento', 'fim_atendimento'];

// Helper: erro genérico em produção, detalhado em dev
function sendErr(res, code, message, error) {
  const isProd = process.env.NODE_ENV === 'production';
  res.status(code).json({
    success: false,
    error: isProd ? message : (error?.message || message)
  });
}

// GET /ponto
router.get('/ponto', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM registros_ponto WHERE profissional_id = $1 AND salao_id = $2 AND DATE(created_at) = CURRENT_DATE ORDER BY created_at`,
      [req.profissionalId, req.salaoId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar ponto:', error);
    sendErr(res, 500, 'Erro ao buscar ponto', error);
  }
});

// POST /ponto
// [P5-M3] rate limit aplicado
router.post('/ponto', pontoLimiter, [
  body('tipo').isIn(TIPOS_PONTO).withMessage('Tipo inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const result = await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, $3) RETURNING *`,
      [req.profissionalId, req.salaoId, req.body.tipo]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    // [P3-B6] Em prod logar apenas message + stack curta (não objeto inteiro com params)
    console.error('Erro ao registrar ponto:', error.message);
    sendErr(res, 500, 'Erro ao registrar ponto', error);
  }
});

// GET /agenda
router.get('/agenda', async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, s.nome as servico_nome
       FROM agendamentos a
       LEFT JOIN clientes c ON c.id = a.cliente_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.profissional_id = $1 AND a.salao_id = $2 AND DATE(a.data_hora) = $3::date
       ORDER BY a.data_hora`,
      [req.profissionalId, req.salaoId, data]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    sendErr(res, 500, 'Erro ao buscar agenda', error);
  }
});

// GET /atendimentos
router.get('/atendimentos', async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT at.*, c.nome as cliente_nome, s.nome as servico_nome
       FROM atendimentos at
       LEFT JOIN clientes c ON c.id = at.cliente_id
       LEFT JOIN servicos s ON s.id = at.servico_id
       WHERE at.profissional_id = $1 AND at.salao_id = $2 AND DATE(at.created_at) = $3::date
       ORDER BY at.created_at DESC`,
      [req.profissionalId, req.salaoId, data]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar atendimentos:', error);
    sendErr(res, 500, 'Erro ao buscar atendimentos', error);
  }
});

// GET /comissoes
router.get('/comissoes', async (req, res) => {
  try {
    const hoje = new Date();
    const defaultInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

    const data_inicio = req.query.data_inicio || defaultInicio;
    const data_fim = req.query.data_fim || defaultFim;

    const result = await pool.query(
      `SELECT * FROM comissoes
       WHERE profissional_id = $1 AND salao_id = $2 AND DATE(created_at) BETWEEN $3::date AND $4::date
       ORDER BY created_at DESC`,
      [req.profissionalId, req.salaoId, data_inicio, data_fim]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar comissões:', error);
    sendErr(res, 500, 'Erro ao buscar comissões', error);
  }
});

// POST /produtos-utilizados
router.post('/produtos-utilizados', [
  body('marca').notEmpty().withMessage('Marca é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { marca, coloracao, quantidade, cliente_id, cliente_nome, observacoes, agendamento_id, produto_id } = req.body;
    const qtd = quantidade || 1;

    // Validar que IDs referenciados pertencem ao salão do profissional (defesa cross-tenant)
    if (cliente_id) {
      const ok = await pool.query('SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2', [cliente_id, req.salaoId]);
      if (!ok.rows.length) return res.status(403).json({ success: false, error: 'cliente_id não pertence ao salão' });
    }
    if (agendamento_id) {
      const ok = await pool.query('SELECT 1 FROM agendamentos WHERE id = $1 AND salao_id = $2', [agendamento_id, req.salaoId]);
      if (!ok.rows.length) return res.status(403).json({ success: false, error: 'agendamento_id não pertence ao salão' });
    }
    if (produto_id) {
      const ok = await pool.query('SELECT 1 FROM produtos WHERE id = $1 AND salao_id = $2', [produto_id, req.salaoId]);
      if (!ok.rows.length) return res.status(403).json({ success: false, error: 'produto_id não pertence ao salão' });
    }

    // [P2-A4] Transação com UPDATE condicional para evitar overdraft de estoque.
    // O UPDATE só aplica se quantidade_estoque >= qtd; senão, rollback e 400.
    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      if (produto_id) {
        const upd = await client.query(
          `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1
           WHERE id = $2 AND salao_id = $3 AND quantidade_estoque >= $1
           RETURNING quantidade_estoque`,
          [qtd, produto_id, req.salaoId]
        );
        if (!upd.rows.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: 'Estoque insuficiente' });
        }
      }
      inserted = await client.query(
        `INSERT INTO produtos_utilizados (profissional_id, salao_id, cliente_id, cliente_nome, marca, coloracao, quantidade, observacoes, agendamento_id, produto_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [req.profissionalId, req.salaoId, cliente_id || null, cliente_nome || null, marca, coloracao || null, qtd, observacoes || null, agendamento_id || null, produto_id || null]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch {}
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar produto utilizado:', error);
    sendErr(res, 500, 'Erro ao registrar produto utilizado', error);
  }
});

// GET /produtos-utilizados
router.get('/produtos-utilizados', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM produtos_utilizados WHERE profissional_id = $1 AND salao_id = $2 ORDER BY created_at DESC LIMIT 100`,
      [req.profissionalId, req.salaoId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao listar produtos utilizados:', error);
    sendErr(res, 500, 'Erro ao listar produtos utilizados', error);
  }
});

// GET /atendimentos-hoje
router.get('/atendimentos-hoje', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, s.nome as servico_nome
      FROM agendamentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE a.profissional_id = $1 AND a.salao_id = $2 AND DATE(a.data_hora) = $3::date
        AND a.status IN ('agendado', 'confirmado', 'em_andamento')
      ORDER BY a.data_hora
    `, [req.profissionalId, req.salaoId, hoje]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar atendimentos de hoje:', error);
    sendErr(res, 500, 'Erro ao buscar atendimentos de hoje', error);
  }
});

// POST /atendimentos/:id/iniciar
// [P10-M1] Refatorado para atravessar AgendamentoService.atualizar (state machine P9-A1):
//   - Valida ownership (agendamento pertence ao salão + profissional do JWT).
//   - Valida transição via state machine (somente agendado/confirmado → em_andamento).
//   - Cria atendimento associado via AtendimentoService.criar (com valor server-side de servico.preco).
//   - Audit log explícito ('agendamento.iniciar').
// [P5-M4] Idempotência: se agendamento já está 'em_andamento', retorna 200 sem duplicar
//   ponto, atendimento ou audit log.
router.post('/atendimentos/:id/iniciar', async (req, res) => {
  try {
    // 1) Carregar agendamento e validar tenancy estrita (salão + profissional do JWT)
    const agendRow = await pool.query(
      `SELECT * FROM agendamentos WHERE id = $1 AND profissional_id = $2 AND salao_id = $3`,
      [req.params.id, req.profissionalId, req.salaoId]
    );
    if (!agendRow.rows.length) {
      return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });
    }
    const ag = agendRow.rows[0];

    // 2) Idempotência — se já em_andamento, retorna sem efeitos colaterais.
    if (ag.status === 'em_andamento') {
      const existing = await pool.query(
        `SELECT * FROM atendimentos WHERE agendamento_id = $1 AND profissional_id = $2 AND salao_id = $3 LIMIT 1`,
        [ag.id, req.profissionalId, req.salaoId]
      );
      return res.json({
        success: true,
        data: existing.rows[0] || ag,
        message: 'já em andamento',
      });
    }

    // 3) Bloquear transição inválida explicitamente (defesa em profundidade — o service
    //    também valida). Apenas agendado/confirmado podem iniciar.
    if (!['agendado', 'confirmado'].includes(ag.status)) {
      return res.status(400).json({
        success: false,
        error: `Não é possível iniciar atendimento com status '${ag.status}'`,
      });
    }

    // 4) Transição via state machine
    const updResult = await agendamentoService.atualizar(
      ag.id,
      { status: 'em_andamento' },
      req.salaoId,
      { req }
    );
    if (!updResult.success) {
      return res.status(400).json({ success: false, error: updResult.error });
    }

    // 5) Cria atendimento associado (idempotente — verifica se já existe)
    let atendimento;
    const existing = await pool.query(
      `SELECT * FROM atendimentos WHERE agendamento_id = $1 AND profissional_id = $2 AND salao_id = $3 LIMIT 1`,
      [ag.id, req.profissionalId, req.salaoId]
    );
    if (existing.rows.length) {
      atendimento = existing.rows[0];
    } else {
      const atendResult = await atendimentoService.criar({
        cliente_id: ag.cliente_id,
        profissional_id: req.profissionalId,
        servico_id: ag.servico_id,
        agendamento_id: ag.id,
        status: 'em_andamento',
        observacoes: req.body?.observacoes || null,
      }, req.salaoId);
      if (!atendResult.success) {
        return res.status(400).json({ success: false, error: atendResult.error });
      }
      atendimento = atendResult.data;
    }

    // 6) Insere registro de ponto
    await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, 'inicio_atendimento')`,
      [req.profissionalId, req.salaoId]
    );

    // 7) Audit log
    await logAction({
      req,
      action: 'agendamento.iniciar',
      entityType: 'agendamento',
      entityId: ag.id,
      before: { status: ag.status },
      after: { status: 'em_andamento', atendimento_id: atendimento.id },
      salaoId: req.salaoId,
    }).catch(() => {});

    res.json({ success: true, data: { ...updResult.data, atendimento } });
  } catch (error) {
    console.error('Erro ao iniciar atendimento:', error);
    sendErr(res, 500, 'Erro ao iniciar atendimento', error);
  }
});

// GET /perfil
router.get('/perfil', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, email, telefone, especialidade, comissao, ativo
       FROM profissionais WHERE id = $1 AND salao_id = $2`,
      [req.profissionalId, req.salaoId]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar perfil do profissional:', error);
    sendErr(res, 500, 'Erro ao buscar perfil', error);
  }
});

// POST /aviso-atraso
router.post('/aviso-atraso', [
  body('agendamento_id').notEmpty().withMessage('agendamento_id é obrigatório'),
  body('minutos').isInt({ min: 1 }).withMessage('minutos deve ser inteiro positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { agendamento_id, minutos, mensagem } = req.body;

    const agend = await pool.query(
      'SELECT * FROM agendamentos WHERE id = $1 AND profissional_id = $2 AND salao_id = $3',
      [agendamento_id, req.profissionalId, req.salaoId]
    );
    if (!agend.rows.length)
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

    // Registrar notificação de atraso para o cliente
    const ag = agend.rows[0];
    const textoNotif = mensagem || `Seu profissional chegará com aproximadamente ${minutos} minutos de atraso.`;

    await pool.query(
      `INSERT INTO notificacoes (salao_id, cliente_id, tipo, titulo, mensagem, lida)
       VALUES ($1, $2, 'aviso_atraso', 'Aviso de Atraso', $3, false)`,
      [req.salaoId, ag.cliente_id, textoNotif]
    );

    // Enviar push para o cliente do agendamento (validar tenant)
    if (ag.cliente_id) {
      const clienteRow = await pool.query(
        'SELECT push_token FROM clientes WHERE id = $1 AND salao_id = $2 AND push_token IS NOT NULL LIMIT 1',
        [ag.cliente_id, req.salaoId]
      );
      if (clienteRow.rows[0]?.push_token) {
        await sendPush(
          clienteRow.rows[0].push_token,
          'Aviso de atraso ⏰',
          textoNotif,
          { screen: 'pedidos' }
        );
      }
    }

    res.json({ success: true, data: { agendamento_id, minutos, mensagem: textoNotif } });
  } catch (error) {
    console.error('Erro ao enviar aviso de atraso:', error);
    sendErr(res, 500, 'Erro ao enviar aviso de atraso', error);
  }
});

// POST /atendimentos/:id/finalizar
// [P10-M1] Refatorado para atravessar state machine de ambas as entidades:
//   - Atendimento: em_andamento → finalizado (AtendimentoService.atualizar, P8-A2).
//   - Agendamento: em_andamento → concluido (AgendamentoService.atualizar, P9-A1).
//   - Comissão calculada server-side (servico.preco × profissional.comissao_percentual).
//   - Audit log explícito ('agendamento.finalizar').
// [P5-M4] Idempotência: se atendimento já está 'finalizado', retorna 200 sem efeitos colaterais.
router.post('/atendimentos/:id/finalizar', async (req, res) => {
  try {
    // 1) Carregar agendamento e validar tenancy (salão + profissional do JWT)
    const agendRow = await pool.query(
      'SELECT * FROM agendamentos WHERE id = $1 AND profissional_id = $2 AND salao_id = $3',
      [req.params.id, req.profissionalId, req.salaoId]
    );
    if (!agendRow.rows.length) {
      return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });
    }
    const ag = agendRow.rows[0];

    // 2) Buscar atendimento associado (criado em /iniciar)
    const atendRow = await pool.query(
      `SELECT * FROM atendimentos WHERE agendamento_id = $1 AND profissional_id = $2 AND salao_id = $3 LIMIT 1`,
      [ag.id, req.profissionalId, req.salaoId]
    );

    // 3) Idempotência — se atendimento já finalizado, retorna sem efeitos colaterais.
    if (atendRow.rows.length && atendRow.rows[0].status === 'finalizado') {
      return res.json({
        success: true,
        data: atendRow.rows[0],
        message: 'atendimento já finalizado',
      });
    }

    // 4) Pré-condição: agendamento deve estar em_andamento.
    //    (Bloqueia finalizar de agendamento cancelado/concluido/no_show.)
    if (ag.status !== 'em_andamento') {
      return res.status(400).json({
        success: false,
        error: `Não é possível finalizar: agendamento está com status '${ag.status}' (esperado: em_andamento)`,
      });
    }

    // 5) Garantir que existe atendimento associado (se /iniciar nunca foi chamado,
    //    cria agora com status em_andamento — preserva fluxos legados antes de finalizar).
    let atendimento;
    if (atendRow.rows.length) {
      atendimento = atendRow.rows[0];
    } else {
      const criar = await atendimentoService.criar({
        cliente_id: ag.cliente_id,
        profissional_id: req.profissionalId,
        servico_id: ag.servico_id,
        agendamento_id: ag.id,
        status: 'em_andamento',
        observacoes: req.body?.observacoes || null,
      }, req.salaoId);
      if (!criar.success) {
        return res.status(400).json({ success: false, error: criar.error });
      }
      atendimento = criar.data;
    }

    // 6) Validar transição atendimento atual
    if (atendimento.status !== 'em_andamento') {
      return res.status(400).json({
        success: false,
        error: `Atendimento está em '${atendimento.status}' (esperado: em_andamento)`,
      });
    }

    // 7) Finalizar atendimento via state machine (em_andamento → finalizado)
    const atendUpd = await atendimentoService.atualizar(
      atendimento.id,
      { status: 'finalizado', observacoes: req.body?.observacoes || undefined },
      req.salaoId,
      { req }
    );
    if (!atendUpd.success) {
      return res.status(400).json({ success: false, error: atendUpd.error });
    }

    // 8) Concluir agendamento via state machine (em_andamento → concluido)
    const agendUpd = await agendamentoService.atualizar(
      ag.id,
      { status: 'concluido' },
      req.salaoId,
      { req }
    );
    if (!agendUpd.success) {
      return res.status(400).json({ success: false, error: agendUpd.error });
    }

    // 9) Calcular comissão server-side a partir de servico.preco × profissional.comissao_percentual.
    //    Valor autoritativo — payload do cliente NÃO pode inflacionar comissão.
    let comissaoRow = null;
    try {
      const srv = ag.servico_id
        ? (await pool.query('SELECT preco FROM servicos WHERE id = $1 AND salao_id = $2', [ag.servico_id, req.salaoId])).rows[0]
        : null;
      const prof = (await pool.query('SELECT comissao_percentual FROM profissionais WHERE id = $1 AND salao_id = $2', [req.profissionalId, req.salaoId])).rows[0];
      const preco = Number(srv?.preco) || Number(atendimento.valor) || 0;
      const percentual = Number(prof?.comissao_percentual) || 0;
      if (preco > 0 && percentual > 0) {
        const valorComissao = Math.round(preco * percentual) / 100;
        const ins = await pool.query(
          `INSERT INTO comissoes (profissional_id, venda_id, valor_total, percentual, valor_comissao, salao_id)
           VALUES ($1, NULL, $2, $3, $4, $5) RETURNING *`,
          [req.profissionalId, preco, percentual, valorComissao, req.salaoId]
        );
        comissaoRow = ins.rows[0];
      }
    } catch (comErr) {
      // Comissão não deve abortar o finalizar — apenas loga.
      console.error('Erro ao calcular comissão:', comErr.message);
    }

    // 10) Registrar ponto fim_atendimento
    await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, 'fim_atendimento')`,
      [req.profissionalId, req.salaoId]
    );

    // 11) Audit log explícito
    await logAction({
      req,
      action: 'agendamento.finalizar',
      entityType: 'agendamento',
      entityId: ag.id,
      before: { agendamento_status: ag.status, atendimento_status: atendimento.status },
      after: {
        agendamento_status: 'concluido',
        atendimento_status: 'finalizado',
        atendimento_id: atendimento.id,
        comissao_id: comissaoRow?.id || null,
        comissao_valor: comissaoRow?.valor_comissao || null,
      },
      salaoId: req.salaoId,
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        atendimento: atendUpd.data,
        agendamento: agendUpd.data,
        comissao: comissaoRow,
      },
    });
  } catch (error) {
    console.error('Erro ao finalizar atendimento:', error);
    sendErr(res, 500, 'Erro ao finalizar atendimento', error);
  }
});

// GET /chat — histórico de mensagens do profissional
router.get('/chat', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM chat_mensagens
       WHERE salao_id = $1
         AND (remetente_id = $2 OR destinatario_id = $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.salaoId, req.profissionalId]
    );
    res.json({ success: true, data: result.rows.reverse() });
  } catch (error) {
    console.error('Erro ao buscar chat:', error);
    sendErr(res, 500, 'Erro ao buscar chat', error);
  }
});

module.exports = router;
