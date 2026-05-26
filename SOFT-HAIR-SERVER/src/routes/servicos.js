const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { ServicoService } = require('../services');

// Recepção pode criar/editar serviços. DELETE permanece admin-only.
const requireAdminOrRecepcao = requireAnyRole(['admin', 'recepcao']);

const service = new ServicoService();

// [P6-A3] Whitelist explícita de campos editáveis em servicos
const SERVICO_UPDATABLE_FIELDS = [
  'nome', 'descricao', 'preco', 'duracao_minutos', 'cor',
  'categoria', 'comissao_percentual', 'ativo'
];
function pickWhitelist(body, allowed) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

// Listar serviços
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { ativo, search, limit = 100 } = req.query;
    const { query } = require('../config/database');
    const salaoId = req.salaoId;

    let conditions = ['salao_id = $1'];
    let params = [salaoId];
    let idx = 2;

    if (ativo !== undefined) { conditions.push(`ativo = $${idx++}`); params.push(ativo === 'true'); }
    if (search) {
      // [P3-M8] Escapa wildcards
      const safe = require('../utils/helpers').escapeLike(search);
      conditions.push(`(nome ILIKE $${idx} OR descricao ILIKE $${idx})`);
      params.push(`%${safe}%`); idx++;
    }

    const lim = Math.min(parseInt(limit) || 100, 2000);
    const rows = await query(
      `SELECT * FROM servicos WHERE ${conditions.join(' AND ')} ORDER BY nome ASC LIMIT $${idx}`,
      [...params, lim]
    );
    const total = await query(`SELECT COUNT(*) FROM servicos WHERE ${conditions.join(' AND ')}`, params);
    const data = rows.rows || rows;
    res.json({ success: true, data, total: parseInt((total.rows || total)[0].count) });
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

// Criar serviço — admin + recepção
router.post('/', authMiddleware, requireAdminOrRecepcao, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('preco').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo'),
  body('duracao_minutos').optional().isInt({ min: 1 }).withMessage('Duração deve ser em minutos'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const safeBody = pickWhitelist(req.body, SERVICO_UPDATABLE_FIELDS);
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

// Atualizar — admin + recepção
router.put('/:id', authMiddleware, requireAdminOrRecepcao, [
  body('nome').optional().isLength({ min: 2 }),
  body('preco').optional().isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const safeBody = pickWhitelist(req.body, SERVICO_UPDATABLE_FIELDS);
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
      res.json({ success: true, message: result.message || 'Serviço desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
