const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

const CATEGORIAS = ['Aluguel','Energia','Água','Produtos','Equipamentos','Marketing','Salário','Impostos','Outros'];

// Listar despesas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { mes, ano, categoria } = req.query;
    let sql = 'SELECT * FROM despesas WHERE salao_id = $1';
    const params = [req.salaoId];

    if (mes && ano) {
      params.push(mes, ano);
      sql += ` AND EXTRACT(MONTH FROM data) = $${params.length - 1} AND EXTRACT(YEAR FROM data) = $${params.length}`;
    }
    if (categoria) {
      params.push(categoria);
      sql += ` AND categoria = $${params.length}`;
    }
    sql += ' ORDER BY data DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Resumo por categoria
router.get('/resumo', authMiddleware, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    const params = [req.salaoId];
    let filter = '';
    if (mes && ano) {
      params.push(mes, ano);
      filter = ` AND EXTRACT(MONTH FROM data) = $${params.length - 1} AND EXTRACT(YEAR FROM data) = $${params.length}`;
    }
    const result = await query(
      `SELECT categoria, SUM(valor) as total, COUNT(*) as quantidade FROM despesas WHERE salao_id = $1${filter} GROUP BY categoria ORDER BY total DESC`,
      params
    );
    const totalResult = await query(
      `SELECT SUM(valor) as total FROM despesas WHERE salao_id = $1${filter}`,
      params
    );
    res.json({
      success: true,
      data: {
        categorias: result.rows,
        total: parseFloat(totalResult.rows[0].total || 0)
      }
    });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Criar despesa
router.post('/', authMiddleware, [
  body('descricao').notEmpty().withMessage('Descrição obrigatória'),
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor inválido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { descricao, valor, categoria = 'Outros', data, recorrente = false, observacoes } = req.body;
    const result = await query(
      `INSERT INTO despesas (salao_id, descricao, valor, categoria, data, recorrente, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.salaoId, descricao, valor, categoria, data || new Date().toISOString().split('T')[0], recorrente, observacoes]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Editar despesa
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { descricao, valor, categoria, data, recorrente, observacoes } = req.body;
    const result = await query(
      `UPDATE despesas SET descricao=$1, valor=$2, categoria=$3, data=$4, recorrente=$5, observacoes=$6
       WHERE id=$7 AND salao_id=$8 RETURNING *`,
      [descricao, valor, categoria, data, recorrente, observacoes, req.params.id, req.salaoId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Despesa não encontrada' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Excluir despesa
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM despesas WHERE id=$1 AND salao_id=$2 RETURNING id',
      [req.params.id, req.salaoId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Despesa não encontrada' });
    res.json({ success: true, message: 'Despesa excluída' });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
