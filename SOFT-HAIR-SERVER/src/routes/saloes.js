const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// Listar salões publicamente (para app mobile de clientes)
router.get('/publico', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT id, nome, endereco, telefone, email, logo_url
      FROM saloes WHERE ativo = true`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND nome ILIKE $1`;
    }
    sql += ' ORDER BY nome';
    const { rows } = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar dados do salão atual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const salao = await queryOne('SELECT * FROM saloes WHERE id = $1', [req.salaoId]);
    if (!salao) return res.status(404).json({ success: false, error: 'Salão não encontrado' });
    res.json({ success: true, data: salao });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar salão atual
router.put('/me', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }),
  body('email').optional().isEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { nome, endereco, telefone, email, cnpj, logo_url, config } = req.body;
    const result = await queryOne(`
      UPDATE saloes SET
        nome = COALESCE($1, nome), endereco = COALESCE($2, endereco),
        telefone = COALESCE($3, telefone), email = COALESCE($4, email),
        cnpj = COALESCE($5, cnpj), logo_url = COALESCE($6, logo_url),
        config = COALESCE($7, config), updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [nome, endereco, telefone, email, cnpj, logo_url, config ? JSON.stringify(config) : null, req.salaoId]);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
