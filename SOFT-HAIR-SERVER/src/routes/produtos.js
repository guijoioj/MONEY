const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { ProdutoService } = require('../services');

// Recepção pode criar/editar produtos (operação de salão).
// Profissional NÃO precisa de produtos. Apenas admin pode DELETE.
const requireAdminOrRecepcao = requireAnyRole(['admin', 'recepcao']);
router.use(authMiddleware, requireAdminOrRecepcao);

const service = new ProdutoService();

// [P6-A3] Whitelist explícita de campos editáveis em produtos
const PRODUTO_UPDATABLE_FIELDS = [
  'nome', 'descricao', 'preco_venda', 'preco_custo',
  'quantidade_estoque', 'quantidade_minima', 'categoria',
  'codigo_barras', 'marca', 'foto_url', 'ativo'
];
function pickWhitelist(body, allowed) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

// Projection por role: recepção NÃO recebe preco_custo, preco_venda original etc.
// Admin recebe tudo.
const PRODUTO_FIELDS_ADMIN = `id, salao_id, nome, descricao, categoria, marca,
  codigo_barras, preco_custo, preco_venda, quantidade_estoque, quantidade_minima,
  foto_url, ativo, created_at, updated_at`;
const PRODUTO_FIELDS_RECEP = `id, salao_id, nome, descricao, categoria, marca,
  codigo_barras, preco_venda, quantidade_estoque, foto_url, ativo`;

// Listar produtos — projection por role.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { ativo, search, categoria, limit = 200 } = req.query;
    const { query } = require('../config/database');
    const salaoId = req.salaoId;
    const fields = req.user?.tipo === 'admin' ? PRODUTO_FIELDS_ADMIN : PRODUTO_FIELDS_RECEP;

    let conditions = ['salao_id = $1'];
    let params = [salaoId];
    let idx = 2;

    if (ativo !== undefined) { conditions.push(`ativo = $${idx++}`); params.push(ativo === 'true'); }
    if (categoria) { conditions.push(`categoria = $${idx++}`); params.push(categoria); }
    if (search) {
      // [P3-M8] Escapa wildcards LIKE/ILIKE (%, _, \)
      const safe = require('../utils/helpers').escapeLike(search);
      conditions.push(`(nome ILIKE $${idx} OR descricao ILIKE $${idx} OR marca ILIKE $${idx})`);
      params.push(`%${safe}%`); idx++;
    }

    const lim = Math.min(parseInt(limit) || 200, 2000);
    const rows = await query(
      `SELECT ${fields} FROM produtos WHERE ${conditions.join(' AND ')} ORDER BY nome ASC LIMIT $${idx}`,
      [...params, lim]
    );
    const total = await query(`SELECT COUNT(*) FROM produtos WHERE ${conditions.join(' AND ')}`, params);
    const data = rows.rows || rows;
    res.json({ success: true, data, total: parseInt((total.rows || total)[0].count) });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Produtos com estoque baixo
router.get('/estoque-baixo', authMiddleware, async (req, res) => {
  try {
    const result = await service.estoqueBaixo(req.salaoId);
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar por ID
// Buscar por ID — projection por role.
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { queryOne } = require('../config/database');
    const fields = req.user?.tipo === 'admin' ? PRODUTO_FIELDS_ADMIN : PRODUTO_FIELDS_RECEP;
    const data = await queryOne(
      `SELECT ${fields} FROM produtos WHERE id = $1 AND salao_id = $2`,
      [req.params.id, req.salaoId]
    );
    if (!data) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    res.json({ success: true, data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// PATCH /:id/estoque — recepção ajusta quantidade durante a venda.
// Aceita delta (+/-) ou valor absoluto. Não toca preço/custo.
router.patch('/:id/estoque', authMiddleware, [
  body('delta').optional().isInt({ min: -100000, max: 100000 }),
  body('absoluto').optional().isInt({ min: 0, max: 1000000 }),
  body('motivo').optional().isString().isLength({ max: 200 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { delta, absoluto, motivo } = req.body;
    if (delta == null && absoluto == null) {
      return res.status(400).json({ success: false, error: 'Envie delta ou absoluto' });
    }
    const { queryOne, withTransaction } = require('../config/database');

    // STRICT: ajuste de estoque + audit log na MESMA transação.
    // Se o log falhar, rollback do UPDATE → estoque NÃO muda sem rastro.
    const result = await withTransaction(async (client) => {
      const sql = absoluto != null
        ? `UPDATE produtos SET quantidade_estoque = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND salao_id = $3 RETURNING id, quantidade_estoque`
        : `UPDATE produtos SET quantidade_estoque = GREATEST(0, COALESCE(quantidade_estoque, 0) + $1),
                                updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND salao_id = $3 RETURNING id, quantidade_estoque`;
      const upd = await client.query(sql, [absoluto != null ? absoluto : delta, req.params.id, req.salaoId]);
      if (!upd.rows.length) return { code: 404, body: { success: false, error: 'Produto não encontrado' } };
      const r = upd.rows[0];

      // Audit log na MESMA conexão (mesma transação). Se falhar, transação aborta.
      await client.query(
        `INSERT INTO audit_log
          (salao_id, actor_id, actor_type, action, entity_type, entity_id, after_data, ip, user_agent)
         VALUES ($1, $2, $3, 'produto.ajuste_estoque', 'produto', $4, $5, $6, $7)`,
        [
          req.salaoId,
          req.user?.userId || req.user?.id || null,
          req.user?.tipo || 'unknown',
          Number(req.params.id),
          JSON.stringify({ delta, absoluto, motivo: motivo || null, novo_estoque: r.quantidade_estoque }),
          (req.ip || req.connection?.remoteAddress || '').slice(0, 45) || null,
          (req.headers?.['user-agent'] || '').slice(0, 500) || null,
        ]
      );
      return { code: 200, body: { success: true, data: r } };
    });

    return res.status(result.code).json(result.body);
  } catch (error) {
    // Qualquer falha (UPDATE ou audit log) cai aqui — transação fez rollback automático.
    require("../utils/sendError").sendError(res, 500, "Erro interno (operação revertida)", error);
  }
});

// Criar — ADMIN-ONLY (preço/custo, cadastro mestre).
router.post('/', authMiddleware, requireAdmin, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('preco_venda').isFloat({ min: 0 }).withMessage('Preço de venda deve ser positivo'),
  body('quantidade_estoque').optional().isInt({ min: 0 }).withMessage('Estoque deve ser inteiro positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const safeBody = pickWhitelist(req.body, PRODUTO_UPDATABLE_FIELDS);
    const result = await service.criar(safeBody, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar — ADMIN-ONLY (preço/custo/categorização). Recepção usa PATCH /:id/estoque pra estoque.
router.put('/:id', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }),
  body('preco_venda').optional().isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const safeBody = pickWhitelist(req.body, PRODUTO_UPDATABLE_FIELDS);
    const result = await service.atualizar(req.params.id, safeBody, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Desativar
// [P6-A3] requireAdmin
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message || 'Produto desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
