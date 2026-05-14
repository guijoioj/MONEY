/**
 * P6-C1: rotas básicas de salão.
 *
 * O app embarcado é single-tenant local: existe 1 salão (criado em initDb.js).
 *  - GET /me → retorna o salão atual.
 *  - PUT /me → permite editar nome/endereco/telefone/email/cnpj/logo_url.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { query, queryOne, queryRun } = require('../config/database');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const salao = await queryOne(
      `SELECT id, nome, endereco, telefone, email, cnpj, logo_url, ativo, config, created_at, updated_at
       FROM saloes WHERE id = ?`,
      [req.salaoId]
    );
    if (!salao) {
      return res.json({ success: true, data: { id: req.salaoId || 1, nome: 'Meu Salão' } });
    }
    res.json({ success: true, data: salao });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/me', authMiddleware, [
  body('nome').optional().isString().isLength({ min: 1, max: 200 }),
  body('email').optional().isEmail(),
  body('telefone').optional().isString().isLength({ max: 30 }),
  body('endereco').optional().isString().isLength({ max: 500 }),
  body('cnpj').optional().isString().isLength({ max: 30 }),
  body('logo_url').optional().isString().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const fields = ['nome', 'endereco', 'telefone', 'email', 'cnpj', 'logo_url'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (sets.length === 0) {
      const data = await queryOne(`SELECT * FROM saloes WHERE id = ?`, [req.salaoId]);
      return res.json({ success: true, data });
    }
    sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
    params.push(req.salaoId);
    await queryRun(`UPDATE saloes SET ${sets.join(', ')} WHERE id = ?`, params);
    const data = await queryOne(`SELECT * FROM saloes WHERE id = ?`, [req.salaoId]);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
