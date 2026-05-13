const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { authMiddleware, generateToken } = require('../middleware/auth');

router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, senha } = req.body;

    const user = await queryOne(
      `SELECT u.*, s.nome as salao_nome, s.ativo as salao_ativo
       FROM usuarios u
       JOIN saloes s ON s.id = u.salao_id
       WHERE u.email = ? AND u.ativo = 1`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(senha, user.senha_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    if (!user.salao_ativo) {
      return res.status(403).json({ success: false, error: 'Salão inativo' });
    }

    // Atualizar último acesso
    try {
      await query(`UPDATE usuarios SET ultimo_acesso = datetime('now') WHERE id = ?`, [user.id]);
    } catch {}

    const token = generateToken(user);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          tipo: user.tipo,
          salao_id: user.salao_id,
          salao_nome: user.salao_nome,
        },
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.email, u.nome, u.tipo, u.salao_id, s.nome as salao_nome
       FROM usuarios u
       JOIN saloes s ON s.id = u.salao_id
       WHERE u.id = ?`,
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
