const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { ProfissionalService } = require('../services');
const { invalidateProfissionalCache } = require('../middleware/profissionalAuth');

const service = new ProfissionalService();

// PAINEL próprio do profissional — middleware extrai id direto do req.path
// (req.params NÃO existe em middleware mounted em router.use).
function _painelGuardFromPath(req, res, next) {
  const role = req.user?.tipo;
  if (role === 'admin' || role === 'recepcao') return next();
  if (role === 'profissional') {
    const m = req.path.match(/^\/(\d+)\/painel/);
    const idParam = m ? Number(m[1]) : null;
    const ownId = Number(req.user?.profissionalId);
    if (idParam && ownId && idParam === ownId) return next();
    return res.status(403).json({ success: false, error: 'Painel acessível apenas ao próprio profissional.' });
  }
  return res.status(403).json({ success: false, error: 'Acesso negado.' });
}

// Profissionais:
//   GET  → admin + recepção (recepção precisa listar pra agenda/atendimento)
//   POST/PUT/DELETE → ADMIN-ONLY (dados sensíveis: senha_app, comissão, ativo)
//   /:id/painel* → admin + recepção + profissional (somente próprio painel)
// Guard inteligente: rotas de painel bypassam o role-check blanket.
router.use(authMiddleware, (req, res, next) => {
  if (/^\/\d+\/painel(\/|$)/.test(req.path)) return _painelGuardFromPath(req, res, next);
  return requireAnyRole(['admin', 'recepcao'])(req, res, next);
});

// [P3-A4] Whitelist explícita de campos editáveis em profissionais (impede mass-assignment).
// Campos NUNCA aceitos via body: id, salao_id, senha_hash (direto), usuario_id, created_at, push_token (vai por rota dedicada).
const PROFISSIONAL_ALLOWED_FIELDS = [
  'nome', 'email', 'telefone', 'cpf', 'especialidade', 'comissao_percentual', 'comissao',
  'ativo', 'foto_url', 'app_ativo', 'data_admissao', 'data_nascimento', 'endereco',
  'observacoes'
];

function pickAllowed(body, whitelist) {
  const out = {};
  for (const k of whitelist) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

// Listar profissionais
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { ativo, search } = req.query;
    const { query } = require('../config/database');
    const salaoId = req.salaoId;

    let conditions = ['salao_id = $1'];
    let params = [salaoId];
    let idx = 2;

    if (ativo !== undefined) { conditions.push(`ativo = $${idx++}`); params.push(ativo === 'true'); }
    if (search) {
      // [P3-M8] Escapa wildcards
      const safe = require('../utils/helpers').escapeLike(search);
      conditions.push(`(nome ILIKE $${idx} OR especialidade ILIKE $${idx})`);
      params.push(`%${safe}%`); idx++;
    }

    const rows = await query(
      `SELECT * FROM profissionais WHERE ${conditions.join(' AND ')} ORDER BY nome ASC`,
      params
    );
    const data = rows.rows || rows;
    res.json({ success: true, data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Criar profissional — admin-only (senha_app, comissão).
router.post('/', authMiddleware, requireAdmin, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('comissao_percentual').optional().isFloat({ min: 0, max: 100 }).withMessage('Comissão deve ser entre 0 e 100'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { senha_app } = req.body;
    // [P3-A4] Whitelist explícita: apenas campos permitidos vão pro service.
    const body = pickAllowed(req.body, PROFISSIONAL_ALLOWED_FIELDS);
    if (senha_app) {
      if (senha_app.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(senha_app)) {
        return res.status(400).json({ success: false, error: 'senha_app precisa de mínimo 8 caracteres, com letra e número' });
      }
      body.senha_hash = await bcrypt.hash(senha_app, 12);
      body.app_ativo = true;
    }
    const result = await service.criar(body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar — admin-only (impede mudança de comissão/senha_app pela recepção).
router.put('/:id', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { senha_app } = req.body;
    // [P3-A4] Whitelist explícita no UPDATE: jamais aceitar id/salao_id/usuario_id/senha_hash direto.
    const body = pickAllowed(req.body, PROFISSIONAL_ALLOWED_FIELDS);
    if (senha_app) {
      if (senha_app.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(senha_app)) {
        return res.status(400).json({ success: false, error: 'senha_app precisa de mínimo 8 caracteres, com letra e número' });
      }
      body.senha_hash = await bcrypt.hash(senha_app, 12);
      body.app_ativo = true;
    }
    const result = await service.atualizar(req.params.id, body, req.salaoId);
    if (result.success) {
      // [P7-M3] Se ativo/app_ativo mudou (incluindo via reset de senha_app), invalidar cache
      // do middleware para fechar a janela de até 2min onde token desativado ainda passaria.
      if (Object.prototype.hasOwnProperty.call(body, 'ativo') ||
          Object.prototype.hasOwnProperty.call(body, 'app_ativo')) {
        try { invalidateProfissionalCache(parseInt(req.params.id, 10) || req.params.id); } catch (_) { /* não-fatal */ }
      }
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P2-C4] Desativar — exige admin
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      // [P7-M3] Soft-delete desativa profissional — invalidar cache para fechar janela.
      try { invalidateProfissionalCache(parseInt(req.params.id, 10) || req.params.id); } catch (_) { /* não-fatal */ }
      res.json({ success: true, message: result.message || 'Profissional desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// ============================================================================
// GET /api/profissionais/:id/painel
// Dashboard interno do profissional: comissões agregadas + status + vendas +
// atendimentos + top clientes + top serviços/produtos favoritos dos clientes.
// ============================================================================
router.get('/:id/painel', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { sendError } = require('../utils/sendError');
    const profId = Number(req.params.id);
    const { data_inicio, data_fim } = req.query;

    // Tenancy
    const tenancy = await pool.query(
      'SELECT id, nome, especialidade, comissao_percentual, ativo FROM profissionais WHERE id=$1 AND salao_id=$2',
      [profId, req.salaoId]
    );
    if (!tenancy.rows.length) {
      return res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    }

    const periodoFilter = data_inicio && data_fim
      ? 'AND c.created_at BETWEEN $3 AND $4'
      : '';
    const periodoFilterV = data_inicio && data_fim
      ? 'AND v.created_at BETWEEN $3 AND $4'
      : '';
    const periodoFilterA = data_inicio && data_fim
      ? 'AND a.created_at BETWEEN $3 AND $4'
      : '';
    const params = data_inicio && data_fim
      ? [profId, req.salaoId, data_inicio, data_fim]
      : [profId, req.salaoId];

    const COMISSOES_DEFAULT = { rows: [{
      qtd_total: 0, qtd_validas: 0, qtd_pendente: 0, qtd_paga: 0, qtd_estornada: 0,
      pendente_cents: 0, pago_cents: 0, estornada_cents: 0, total_cents: 0, ultima_comissao_em: null,
    }] };
    const VENDAS_DEFAULT = { rows: [{ qtd: 0, total_faturado: 0 }] };
    const ATEND_DEFAULT  = { rows: [{ qtd: 0, qtd_finalizados: 0, clientes_unicos: 0 }] };

    const [resumoComissoes, vendas, atendimentos, topClientes, topServicos, topProdutos] = await Promise.all([
      // Resumo de comissões — fallback para banco sem colunas V2
      pool.query(`
        SELECT
          COUNT(*)::int AS qtd_total,
          COUNT(*) FILTER (WHERE COALESCE(c.status,'pendente') IN ('pendente','paga'))::int AS qtd_validas,
          COUNT(*) FILTER (WHERE COALESCE(c.status,'pendente')='pendente')::int AS qtd_pendente,
          COUNT(*) FILTER (WHERE COALESCE(c.status,'pendente')='paga')::int AS qtd_paga,
          COUNT(*) FILTER (WHERE COALESCE(c.status,'pendente')='estornada')::int AS qtd_estornada,
          COALESCE(SUM(c.valor_comissao_cents) FILTER (WHERE COALESCE(c.status,'pendente')='pendente'),0)::bigint AS pendente_cents,
          COALESCE(SUM(c.valor_comissao_cents) FILTER (WHERE COALESCE(c.status,'pendente')='paga'),0)::bigint AS pago_cents,
          COALESCE(SUM(c.valor_comissao_cents) FILTER (WHERE COALESCE(c.status,'pendente')='estornada'),0)::bigint AS estornada_cents,
          COALESCE(SUM(c.valor_comissao_cents),0)::bigint AS total_cents,
          MAX(c.created_at) AS ultima_comissao_em
        FROM comissoes c
        WHERE c.profissional_id=$1 AND c.salao_id=$2 ${periodoFilter}
      `, params).catch((err) => { console.warn('[painel] comissoes V2 indisponivel, retornando zeros:', err.message); return COMISSOES_DEFAULT; }),

      // Vendas
      pool.query(`
        SELECT COUNT(*)::int AS qtd,
               COALESCE(SUM(v.valor_final),0)::numeric AS total_faturado
          FROM vendas v
         WHERE v.profissional_id=$1 AND v.salao_id=$2
           AND COALESCE(v.status,'concluida') != 'cancelada'
           ${periodoFilterV}
      `, params).catch(() => VENDAS_DEFAULT),

      // Atendimentos
      pool.query(`
        SELECT COUNT(*)::int AS qtd,
               COUNT(*) FILTER (WHERE a.status='finalizado')::int AS qtd_finalizados,
               COUNT(DISTINCT a.cliente_id)::int AS clientes_unicos
          FROM atendimentos a
         WHERE a.profissional_id=$1 AND a.salao_id=$2
           ${periodoFilterA}
      `, params).catch(() => ATEND_DEFAULT),

      // Top 10 clientes (por nº de atendimentos)
      pool.query(`
        SELECT cl.id, cl.nome, cl.telefone,
               COUNT(a.id)::int AS qtd_atendimentos,
               MAX(a.created_at) AS ultimo_atendimento
          FROM atendimentos a
          JOIN clientes cl ON cl.id = a.cliente_id
         WHERE a.profissional_id=$1 AND a.salao_id=$2
           ${periodoFilterA}
         GROUP BY cl.id, cl.nome, cl.telefone
         ORDER BY qtd_atendimentos DESC
         LIMIT 10
      `, params).catch(() => ({ rows: [] })),

      // Top serviços (mais executados pelo profissional)
      pool.query(`
        SELECT s.id, s.nome, s.categoria,
               COUNT(asv.id)::int AS qtd
          FROM atendimentos_servicos asv
          JOIN atendimentos a ON a.id = asv.atendimento_id
          JOIN servicos s ON s.id = asv.servico_id
         WHERE a.profissional_id=$1 AND a.salao_id=$2
           ${periodoFilterA}
         GROUP BY s.id, s.nome, s.categoria
         ORDER BY qtd DESC
         LIMIT 10
      `, params).catch(() => ({ rows: [] })),

      // Top produtos vendidos pelo profissional
      pool.query(`
        SELECT p.id, p.nome, p.categoria,
               COUNT(vi.id)::int AS qtd_vendas,
               COALESCE(SUM(vi.quantidade),0)::int AS qtd_unidades,
               COALESCE(SUM(vi.valor_total),0)::numeric AS total_vendido
          FROM venda_itens vi
          JOIN vendas v ON v.id = vi.venda_id
          JOIN produtos p ON p.id = vi.produto_id
         WHERE v.profissional_id=$1 AND v.salao_id=$2
           AND COALESCE(v.status,'concluida') != 'cancelada'
           ${periodoFilterV}
         GROUP BY p.id, p.nome, p.categoria
         ORDER BY qtd_vendas DESC
         LIMIT 10
      `, params).catch(() => ({ rows: [] })),
    ]);

    res.json({
      success: true,
      data: {
        profissional: tenancy.rows[0],
        periodo: { data_inicio, data_fim },
        resumo_comissoes: resumoComissoes.rows[0],
        vendas: vendas.rows[0],
        atendimentos: atendimentos.rows[0],
        top_clientes: topClientes.rows,
        top_servicos: topServicos.rows,
        top_produtos: topProdutos.rows,
      },
    });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro montando painel', error);
  }
});

// ============================================================================
// GET /api/profissionais/:id/painel/clientes/:clienteId/favoritos
// Favoritos de UM cliente específico (serviços e produtos preferidos).
// ============================================================================
router.get('/:id/painel/clientes/:clienteId/favoritos', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const profId = Number(req.params.id);
    const clienteId = Number(req.params.clienteId);

    // Tenancy: profissional E cliente devem pertencer ao salão
    const checks = await Promise.all([
      pool.query('SELECT 1 FROM profissionais WHERE id=$1 AND salao_id=$2', [profId, req.salaoId]),
      pool.query('SELECT id, nome, telefone, email FROM clientes WHERE id=$1 AND salao_id=$2', [clienteId, req.salaoId]),
    ]);
    if (!checks[0].rows.length) return res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    if (!checks[1].rows.length) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });

    // Profissional só vê favoritos de cliente que ele já atendeu.
    if (req.user?.tipo === 'profissional') {
      const r = await pool.query(
        'SELECT 1 FROM atendimentos WHERE profissional_id=$1 AND cliente_id=$2 AND salao_id=$3 LIMIT 1',
        [profId, clienteId, req.salaoId]
      );
      if (!r.rows.length) {
        return res.status(403).json({ success: false, error: 'Acesso permitido somente a clientes que você já atendeu.' });
      }
    }

    // Profissional selecionado (pra incluir no payload)
    const profSelRow = await pool.query(
      'SELECT id, nome, especialidade FROM profissionais WHERE id=$1 AND salao_id=$2',
      [profId, req.salaoId]
    ).catch(() => ({ rows: [{ id: profId, nome: null }] }));

    const [
      servicosFav, produtosFav, ultimasVisitas,
      profFavorito, servicosComProf, produtosComProf,
    ] = await Promise.all([
      // Top 5 serviços do cliente (qualquer profissional)
      pool.query(`
        SELECT s.id, s.nome, s.categoria, s.preco,
               COUNT(asv.id)::int AS qtd,
               MAX(a.created_at) AS ultimo_uso
          FROM atendimentos_servicos asv
          JOIN atendimentos a ON a.id = asv.atendimento_id
          JOIN servicos s ON s.id = asv.servico_id
         WHERE a.cliente_id=$1 AND a.salao_id=$2
         GROUP BY s.id, s.nome, s.categoria, s.preco
         ORDER BY qtd DESC
         LIMIT 5
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),

      // Top 5 produtos do cliente
      pool.query(`
        SELECT p.id, p.nome, p.categoria, p.preco_venda,
               COUNT(vi.id)::int AS qtd_compras,
               COALESCE(SUM(vi.quantidade),0)::int AS qtd_unidades,
               MAX(v.created_at) AS ultima_compra
          FROM venda_itens vi
          JOIN vendas v ON v.id = vi.venda_id
          JOIN produtos p ON p.id = vi.produto_id
         WHERE v.cliente_id=$1 AND v.salao_id=$2
           AND COALESCE(v.status,'concluida') != 'cancelada'
         GROUP BY p.id, p.nome, p.categoria, p.preco_venda
         ORDER BY qtd_compras DESC
         LIMIT 5
      `, [clienteId, req.salaoId]).catch(() => ({ rows: [] })),

      // Últimas 5 visitas do cliente com esse profissional
      pool.query(`
        SELECT a.id, a.created_at, a.valor, a.status
          FROM atendimentos a
         WHERE a.cliente_id=$1 AND a.profissional_id=$2 AND a.salao_id=$3
         ORDER BY a.created_at DESC
         LIMIT 5
      `, [clienteId, profId, req.salaoId]).catch(() => ({ rows: [] })),

      // Profissional favorito da cliente (mais frequente em atendimentos finalizados)
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

      // Serviços que a cliente fez COM ESTE profissional específico
      pool.query(`
        SELECT s.id, s.nome, s.categoria,
               COUNT(asv.id)::int AS qtd,
               MAX(a.created_at) AS ultimo_uso
          FROM atendimentos_servicos asv
          JOIN atendimentos a ON a.id = asv.atendimento_id
          JOIN servicos s ON s.id = asv.servico_id
         WHERE a.cliente_id=$1 AND a.profissional_id=$2 AND a.salao_id=$3
         GROUP BY s.id, s.nome, s.categoria
         ORDER BY qtd DESC
         LIMIT 5
      `, [clienteId, profId, req.salaoId]).catch(() => ({ rows: [] })),

      // Produtos comprados em vendas ligadas a ESTE profissional
      pool.query(`
        SELECT p.id, p.nome, p.categoria,
               COUNT(vi.id)::int AS qtd_compras,
               COALESCE(SUM(vi.quantidade),0)::int AS qtd_unidades
          FROM venda_itens vi
          JOIN vendas v ON v.id = vi.venda_id
          JOIN produtos p ON p.id = vi.produto_id
         WHERE v.cliente_id=$1 AND v.profissional_id=$2 AND v.salao_id=$3
           AND COALESCE(v.status,'concluida') != 'cancelada'
         GROUP BY p.id, p.nome, p.categoria
         ORDER BY qtd_compras DESC
         LIMIT 5
      `, [clienteId, profId, req.salaoId]).catch(() => ({ rows: [] })),
    ]);

    res.json({
      success: true,
      data: {
        cliente: checks[1].rows[0],
        profissional_selecionado: profSelRow.rows[0] || null,
        profissional_favorito: profFavorito.rows[0] || null,
        servicos_favoritos: servicosFav.rows,
        produtos_favoritos: produtosFav.rows,
        servicos_com_este_profissional: servicosComProf.rows,
        produtos_com_este_profissional: produtosComProf.rows,
        ultimas_visitas_com_este_profissional: ultimasVisitas.rows,
      },
    });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro buscando favoritos', error);
  }
});

module.exports = router;
