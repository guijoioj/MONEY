const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { ClienteService } = require('../services');
const { invalidateClienteCache } = require('../middleware/clienteAuth');

const clienteService = new ClienteService();

// Clientes: admin + recepção. Profissional NÃO vê clientes do salão (escopo próprio é via /historico).
// DELETE permanece com requireAdmin individual.
router.use(authMiddleware, requireAnyRole(['admin', 'recepcao']));

// Listar clientes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, ativo, page = 1 } = req.query;
    const salaoId = req.salaoId;
    // [P2-B5] Cap superior em 200 para evitar exfiltração massiva.
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const offset = (parseInt(page) - 1) * limit;

    let filtros = {};
    if (ativo !== undefined) filtros.ativo = ativo === 'true';
    if (search) filtros._search = search;

    const result = await clienteService.listar(salaoId, filtros, { limit, offset });
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Clientes inadimplentes (DEVE ficar antes de /:id)
router.get('/inadimplentes', authMiddleware, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const r = await query(`
      SELECT c.id, c.nome, c.telefone, c.email,
        COALESCE(SUM(v.valor_final),0) as total_devido,
        COUNT(v.id) as qtd_vendas_abertas,
        MAX(v.created_at) as ultima_venda
      FROM clientes c
      JOIN vendas v ON v.cliente_id = c.id
      WHERE c.salao_id = $1
        AND v.status IN ('pendente','aberto')
        AND v.salao_id = $1
      GROUP BY c.id, c.nome, c.telefone, c.email
      HAVING SUM(v.valor_final) > 0
      ORDER BY total_devido DESC
    `, [req.salaoId]);
    res.json({ success: true, data: r.rows });
  } catch(e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// Aniversariantes da semana (DEVE ficar antes de /:id)
router.get('/aniversariantes', authMiddleware, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const r = await query(`
      SELECT id, nome, telefone, email, data_nascimento,
        EXTRACT(DAY FROM data_nascimento) as dia,
        EXTRACT(MONTH FROM data_nascimento) as mes
      FROM clientes
      WHERE salao_id = $1
        AND data_nascimento IS NOT NULL
        AND ativo = true
        AND (
          EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM data_nascimento) BETWEEN
            EXTRACT(DAY FROM CURRENT_DATE) AND
            EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '7 days')
        )
      ORDER BY EXTRACT(DAY FROM data_nascimento)
    `, [req.salaoId]);
    res.json({ success: true, data: r.rows });
  } catch(e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// Obter cliente por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.buscarPorId(id, salaoId);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Normalizer explícito: frontend pode mandar camelCase, DB usa snake_case.
// Whitelist + rename evita que coluna inexistente (ex: "dataNascimento") chegue ao SQL.
const CLIENTE_WRITABLE = new Set([
  'nome', 'telefone', 'email', 'cpf', 'data_nascimento',
  'endereco', 'observacoes', 'foto_url', 'ativo',
]);
function normalizeClientePayload(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    // camelCase → snake_case explícito
    const key = k === 'dataNascimento' ? 'data_nascimento'
              : k === 'fotoUrl' ? 'foto_url'
              : k;
    if (CLIENTE_WRITABLE.has(key)) out[key] = v;
  }
  return out;
}

// Criar cliente
router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('telefone').optional({ checkFalsy: true }).isString().isLength({ min: 8, max: 25 }).withMessage('Telefone inválido'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('cpf').optional().isLength({ min: 11, max: 14 }).withMessage('CPF deve ter entre 11 e 14 caracteres'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const salaoId = req.salaoId;
    const safeBody = normalizeClientePayload(req.body);
    if (!safeBody.nome) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    const result = await clienteService.criar(safeBody, salaoId);

    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar cliente
// [P6-A3] requireAdmin + whitelist explícita de campos editáveis.
// NUNCA aceitar senha_hash, credito_disponivel, app_ativo, push_token direto —
// esses campos têm rotas dedicadas com lógica própria (PUT /credito, /push-token, etc).
const CLIENTE_UPDATABLE_FIELDS = [
  'nome', 'telefone', 'email', 'cpf', 'data_nascimento',
  'endereco', 'observacoes', 'foto_url', 'ativo'
];
function pickWhitelist(body, allowed) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

router.put('/:id', authMiddleware, /* admin+recepcao via router.use no topo */ [
  body('nome').optional().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('telefone').optional({ checkFalsy: true }).isString().isLength({ min: 8, max: 25 }).withMessage('Telefone inválido'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const salaoId = req.salaoId;

    // Normaliza camelCase → snake_case (mesma whitelist do POST) antes de gravar.
    const safeBody = normalizeClientePayload(req.body);
    const result = await clienteService.atualizar(id, safeBody, salaoId);

    if (result.success) {
      // [P7-M3] Se ativo/app_ativo mudou, invalidar cache do middleware para fechar
      // a janela de até 2min onde token de cliente desativado ainda passaria.
      if (Object.prototype.hasOwnProperty.call(safeBody, 'ativo') ||
          Object.prototype.hasOwnProperty.call(safeBody, 'app_ativo')) {
        try { invalidateClienteCache(parseInt(id, 10) || id); } catch (_) { /* não-fatal */ }
      }
      res.json({ success: true, data: result.data });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Deletar cliente (soft delete)
// [P6-A3] requireAdmin — apenas admin pode desativar clientes
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.deletar(id, salaoId);

    if (result.success) {
      // [P7-M3] Soft-delete desativa cliente — invalidar cache para fechar janela de 2min.
      try { invalidateClienteCache(parseInt(id, 10) || id); } catch (_) { /* não-fatal */ }
      res.json({ success: true, message: result.message || 'Cliente desativado com sucesso' });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar clientes por termo (nome, telefone ou email)
router.get('/search/:termo', authMiddleware, async (req, res) => {
  try {
    const { termo } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.buscarPorTermo(termo, salaoId, 20);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Adicionar crédito ao cliente
router.put('/:id/credito', authMiddleware, [
  body('valor').isFloat({ min: 0 }).withMessage('Valor deve ser um número positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const salaoId = req.salaoId;
    const { valor } = req.body;

    const result = await clienteService.adicionarCredito(id, valor, salaoId);

    if (result.success) {
      res.json({ success: true, data: result.data, message: result.message });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao adicionar crédito:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// ============================================================================
// GET /api/clientes/:id/perfil
// Perfil consolidado automático: resumo + favoritos + últimas atividades.
// Calculado sob demanda. NÃO salva no cliente.
// Resiliente: se tabela auxiliar faltar, retorna zeros/[] sem quebrar.
// ============================================================================
router.get('/:id/perfil', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const clienteId = Number(req.params.id);

    const cli = await pool.query(
      'SELECT id, nome, telefone, email, data_nascimento, created_at FROM clientes WHERE id=$1 AND salao_id=$2',
      [clienteId, req.salaoId]
    );
    if (!cli.rows.length) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });

    const [resumo, favProf, favServ, favProd, ultAtend, ultCompras] = await Promise.all([
      // Resumo: totais + ticket médio + última visita + frequência
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM atendimentos WHERE cliente_id=$1 AND salao_id=$2 AND status IN ('finalizado','concluido','concluida')) AS total_atendimentos,
          (SELECT COUNT(*)::int FROM vendas WHERE cliente_id=$1 AND salao_id=$2 AND COALESCE(status,'concluida') != 'cancelada') AS total_vendas,
          (SELECT COALESCE(SUM(valor_final),0)::numeric FROM vendas WHERE cliente_id=$1 AND salao_id=$2 AND COALESCE(status,'concluida') != 'cancelada') AS total_gasto,
          (SELECT MAX(created_at) FROM atendimentos WHERE cliente_id=$1 AND salao_id=$2) AS ultima_visita
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [{ total_atendimentos:0, total_vendas:0, total_gasto:0, ultima_visita:null }] })),

      // Profissional favorito
      pool.query(`
        SELECT p.id, p.nome,
               COUNT(a.id)::int AS qtd_atendimentos,
               MAX(a.created_at) AS ultima_visita
          FROM atendimentos a
          JOIN profissionais p ON p.id = a.profissional_id
         WHERE a.cliente_id=$1 AND a.salao_id=$2
           AND a.status IN ('finalizado','concluido','concluida')
         GROUP BY p.id, p.nome
         ORDER BY qtd_atendimentos DESC, ultima_visita DESC
         LIMIT 1
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),

      // Serviço favorito
      pool.query(`
        SELECT s.id, s.nome, s.categoria, s.preco,
               COUNT(asv.id)::int AS qtd
          FROM atendimentos_servicos asv
          JOIN atendimentos a ON a.id = asv.atendimento_id
          JOIN servicos s ON s.id = asv.servico_id
         WHERE a.cliente_id=$1 AND a.salao_id=$2
         GROUP BY s.id, s.nome, s.categoria, s.preco
         ORDER BY qtd DESC
         LIMIT 1
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),

      // Produto favorito
      pool.query(`
        SELECT p.id, p.nome, p.categoria, p.preco_venda,
               COUNT(vi.id)::int AS qtd_compras,
               COALESCE(SUM(vi.quantidade),0)::int AS qtd_unidades
          FROM venda_itens vi
          JOIN vendas v ON v.id = vi.venda_id
          JOIN produtos p ON p.id = vi.produto_id
         WHERE v.cliente_id=$1 AND v.salao_id=$2
           AND COALESCE(v.status,'concluida') != 'cancelada'
         GROUP BY p.id, p.nome, p.categoria, p.preco_venda
         ORDER BY qtd_compras DESC
         LIMIT 1
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),

      // Últimos 10 atendimentos
      pool.query(`
        SELECT a.id, a.created_at, a.valor, a.status, p.nome AS profissional_nome
          FROM atendimentos a
          LEFT JOIN profissionais p ON p.id = a.profissional_id
         WHERE a.cliente_id=$1 AND a.salao_id=$2
         ORDER BY a.created_at DESC
         LIMIT 10
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),

      // Últimas 10 compras
      pool.query(`
        SELECT v.id, v.created_at, v.valor_final, v.forma_pagamento, v.status, p.nome AS profissional_nome
          FROM vendas v
          LEFT JOIN profissionais p ON p.id = v.profissional_id
         WHERE v.cliente_id=$1 AND v.salao_id=$2
         ORDER BY v.created_at DESC
         LIMIT 10
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),
    ]);

    const r = resumo.rows[0] || {};
    const totalGasto = Number(r.total_gasto || 0);
    const totalVendas = Number(r.total_vendas || 0);
    const ticketMedio = totalVendas > 0 ? totalGasto / totalVendas : 0;

    // Frequência média (dias entre atendimentos): se há 2+ atendimentos, calcula
    let frequenciaDiasMedia = null;
    if (Number(r.total_atendimentos) >= 2 && r.ultima_visita) {
      const primAtend = await pool.query(
        'SELECT MIN(created_at) AS primeira FROM atendimentos WHERE cliente_id=$1 AND salao_id=$2 AND status IN (\'finalizado\',\'concluido\',\'concluida\')',
        [clienteId, req.salaoId]
      ).catch(() => ({ rows: [{ primeira: null }] }));
      const prim = primAtend.rows[0]?.primeira;
      if (prim) {
        const dias = (new Date(r.ultima_visita) - new Date(prim)) / (1000 * 60 * 60 * 24);
        frequenciaDiasMedia = Math.round(dias / (r.total_atendimentos - 1));
      }
    }

    res.json({
      success: true,
      data: {
        cliente: cli.rows[0],
        resumo: {
          total_atendimentos: Number(r.total_atendimentos || 0),
          total_vendas: totalVendas,
          total_gasto: totalGasto,
          ticket_medio: Number(ticketMedio.toFixed(2)),
          ultima_visita: r.ultima_visita,
          frequencia_dias_media: frequenciaDiasMedia,
        },
        favoritos: {
          profissional: favProf.rows[0] || null,
          servico: favServ.rows[0] || null,
          produto: favProd.rows[0] || null,
        },
        ultimos_atendimentos: ultAtend.rows,
        ultimas_compras: ultCompras.rows,
      },
    });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro montando perfil', error);
  }
});

module.exports = router;