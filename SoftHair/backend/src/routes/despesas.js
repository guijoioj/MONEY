/**
 * P5-A1: CRUD básico de despesas para fechamento financeiro local.
 *
 * Tabela definida em initDb.js. Não sincroniza com cloud (local only por ora).
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { query, queryOne, queryRun } = require('../config/database');
const { validateId } = require('../middleware/validateId');

// Aplicar validateId em todas as rotas que usam :id
router.param('id', validateId);

// P6-A1: aceitar tanto mes/ano (formato do frontend) quanto dataInicio/dataFim.
function rangeFromQuery(q) {
  if (q.dataInicio || q.dataFim) {
    return { inicio: q.dataInicio || null, fim: q.dataFim || null };
  }
  if (q.mes && q.ano) {
    const m = String(q.mes).padStart(2, '0');
    const last = new Date(Number(q.ano), Number(q.mes), 0).getDate();
    return {
      inicio: `${q.ano}-${m}-01`,
      fim: `${q.ano}-${m}-${String(last).padStart(2, '0')}`,
    };
  }
  return { inicio: null, fim: null };
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { categoria } = req.query;
    const { inicio, fim } = rangeFromQuery(req.query);
    const params = [req.salaoId || 1];
    let where = 'salao_id = ?';
    if (inicio) { where += ' AND data >= ?'; params.push(inicio); }
    if (fim) { where += ' AND data <= ?'; params.push(fim); }
    if (categoria) { where += ' AND categoria = ?'; params.push(categoria); }
    const rows = await query(
      `SELECT id, descricao, valor, categoria, data, observacoes, created_at, updated_at
       FROM despesas
       WHERE ${where}
       ORDER BY data DESC, id DESC
       LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/resumo', authMiddleware, async (req, res) => {
  try {
    const { inicio, fim } = rangeFromQuery(req.query);
    const params = [req.salaoId || 1];
    let where = 'salao_id = ?';
    if (inicio) { where += ' AND data >= ?'; params.push(inicio); }
    if (fim) { where += ' AND data <= ?'; params.push(fim); }
    const totalRow = await queryOne(
      `SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS count FROM despesas WHERE ${where}`,
      params
    );
    const porCategoria = await query(
      `SELECT COALESCE(categoria, 'Outros') AS categoria,
              COALESCE(SUM(valor), 0) AS total,
              COUNT(*) AS quantidade
       FROM despesas WHERE ${where}
       GROUP BY categoria
       ORDER BY total DESC`,
      params
    );
    // P6-A1: retornar ambos alias para compatibilidade com clientes legados (e o
    // frontend que lia `resumoData.categorias`).
    res.json({
      success: true,
      data: {
        total: Number(totalRow?.total || 0),
        count: Number(totalRow?.count || 0),
        porCategoria,
        categorias: porCategoria,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', authMiddleware, [
  body('descricao').notEmpty().withMessage('Descrição é obrigatória'),
  body('valor').isFloat({ gt: 0 }).withMessage('Valor deve ser positivo'),
  body('data').notEmpty().withMessage('Data é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { descricao, valor, categoria, data, observacoes } = req.body;
    const r = await queryRun(
      `INSERT INTO despesas (salao_id, descricao, valor, categoria, data, observacoes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.salaoId || 1, descricao, valor, categoria || null, data, observacoes || null]
    );
    res.status(201).json({ success: true, data: { id: r.lastInsertRowid } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id', authMiddleware, [
  body('descricao').optional().notEmpty(),
  body('valor').optional().isFloat({ gt: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const id = parseInt(req.params.id, 10);
    const fields = ['descricao', 'valor', 'categoria', 'data', 'observacoes'];
    const sets = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'Nada para atualizar' });
    }
    sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
    values.push(id, req.salaoId || 1);
    await queryRun(
      `UPDATE despesas SET ${sets.join(', ')} WHERE id = ? AND salao_id = ?`,
      values
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await queryRun(
      `DELETE FROM despesas WHERE id = ? AND salao_id = ?`,
      [id, req.salaoId || 1]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
