const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { profissionalAuthMiddleware } = require('../middleware/profissionalAuth');

const crypto = require('crypto');
const signToken = (profissional) =>
  jwt.sign(
    {
      profissionalId: profissional.id,
      salaoId: profissional.salao_id,
      type: 'profissional',
      jti: crypto.randomBytes(16).toString('hex'),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

// POST /login
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, nome, email, telefone, salao_id, senha_hash FROM profissionais WHERE email = $1 AND app_ativo = true',
      [email]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const profissional = result.rows[0];

    if (!profissional.senha_hash)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, profissional.senha_hash);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const { senha_hash, ...user } = profissional;
    const token = signToken(profissional);

    res.json({ success: true, data: { user, token } });
  } catch (error) {
    console.error('Erro no login do profissional:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /me
router.get('/me', profissionalAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, telefone, salao_id, app_ativo FROM profissionais WHERE id = $1',
      [req.profissionalId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Profissional não encontrado' });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar profissional:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /push-token
router.put('/push-token', profissionalAuthMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    await pool.query('UPDATE profissionais SET push_token = $1 WHERE id = $2', [pushToken, req.profissionalId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
