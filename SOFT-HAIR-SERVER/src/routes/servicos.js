const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { ServicoService } = require('../services');

const service = new ServicoService();

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

// Criar serviço
router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('preco').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo'),
  body('duracao_minutos').optional().isInt({ min: 1 }).withMessage('Duração deve ser em minutos'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.criar(req.body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar
router.put('/:id', authMiddleware, [
  body('nome').optional().isLength({ min: 2 }),
  body('preco').optional().isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.atualizar(req.params.id, req.body, req.salaoId);
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
router.delete('/:id', authMiddleware, async (req, res) => {
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
