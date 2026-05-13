const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { query, queryOne, queryRun } = require('../config/database');

// P2-A2 (E28): valida `:id` numérico.
router.param('id', validateId);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, ativo, categoria } = req.query;
    const params = [req.salaoId];
    let sql = `SELECT * FROM produtos WHERE salao_id = ?`;
    if (ativo !== undefined) {
      sql += ` AND ativo = ?`;
      params.push(ativo === 'true' ? 1 : 0);
    }
    if (categoria) {
      sql += ` AND categoria = ?`;
      params.push(categoria);
    }
    if (search) {
      sql += ` AND (nome LIKE ? OR descricao LIKE ? OR codigo_barras LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY nome LIMIT 500`;
    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/estoque-baixo', authMiddleware, async (req, res) => {
  try {
    const data = await query(
      `SELECT * FROM produtos WHERE salao_id = ? AND ativo = 1 AND quantidade_estoque <= quantidade_minima ORDER BY nome`,
      [req.salaoId]
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await queryOne(
      `SELECT * FROM produtos WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!data) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('preco_venda').isFloat({ min: 0 }).withMessage('Preço de venda deve ser positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { nome, descricao, preco_custo, preco_venda, quantidade_estoque, quantidade_minima, categoria, codigo_barras } = req.body;
    const result = await queryRun(
      `INSERT INTO produtos (salao_id, nome, descricao, preco_custo, preco_venda, quantidade_estoque, quantidade_minima, categoria, codigo_barras, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.salaoId, nome, descricao || null,
        preco_custo || null, preco_venda,
        quantidade_estoque || 0, quantidade_minima || 0,
        categoria || null, codigo_barras || null,
      ]
    );
    const data = await queryOne(`SELECT * FROM produtos WHERE id = ?`, [result.lastInsertRowid]);
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await queryOne(
      `SELECT * FROM produtos WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!existing) return res.status(404).json({ success: false, error: 'Produto não encontrado' });

    const fields = ['nome', 'descricao', 'preco_custo', 'preco_venda', 'quantidade_estoque', 'quantidade_minima', 'categoria', 'codigo_barras', 'ativo'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        let val = req.body[f];
        if (f === 'ativo') val = val ? 1 : 0;
        params.push(val);
      }
    }
    if (updates.length === 0) return res.json({ success: true, data: existing });

    updates.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
    params.push(req.params.id, req.salaoId);

    await queryRun(
      `UPDATE produtos SET ${updates.join(', ')} WHERE id = ? AND salao_id = ?`,
      params
    );
    const data = await queryOne(`SELECT * FROM produtos WHERE id = ?`, [req.params.id]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await queryRun(
      `UPDATE produtos SET ativo = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    res.json({ success: true, message: 'Produto desativado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
