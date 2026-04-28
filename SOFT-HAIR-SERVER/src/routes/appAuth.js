const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { clienteAuthMiddleware } = require('../middleware/clienteAuth');

const signToken = (clienteId) =>
  jwt.sign(
    { clienteId, type: 'cliente' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /register
router.post('/register', [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { nome, email, password, telefone } = req.body;

    const existing = await pool.query('SELECT id FROM clientes WHERE email = $1', [email]);
    if (existing.rows.length > 0)
      return res.status(409).json({ success: false, error: 'Email já cadastrado' });

    const senha_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO clientes (nome, email, telefone, senha_hash, app_ativo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, nome, email, telefone`,
      [nome, email, telefone || null, senha_hash]
    );

    const user = result.rows[0];
    const token = signToken(user.id);

    res.status(201).json({ success: true, data: { user, token } });
  } catch (error) {
    console.error('Erro no registro do cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
      'SELECT id, nome, email, telefone, senha_hash FROM clientes WHERE email = $1 AND app_ativo = true',
      [email]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const cliente = result.rows[0];

    if (!cliente.senha_hash)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, cliente.senha_hash);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const { senha_hash, ...user } = cliente;
    const token = signToken(user.id);

    res.json({ success: true, data: { user, token } });
  } catch (error) {
    console.error('Erro no login do cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /me
router.get('/me', clienteAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, telefone, app_ativo FROM clientes WHERE id = $1',
      [req.clienteId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
