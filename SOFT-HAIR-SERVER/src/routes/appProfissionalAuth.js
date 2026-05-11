const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { profissionalAuthMiddleware } = require('../middleware/profissionalAuth');
const { sendError } = require('../utils/sendError');

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
// [M4] Aceita `salaoId` opcional no body para desambiguar profissionais com mesmo email
// em diferentes salões. Se múltiplos matches e nenhum salaoId informado, retorna 409.
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
  body('salaoId').optional().isInt({ min: 1 }).withMessage('salaoId inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password, salaoId } = req.body;

    const params = [email];
    let sql = 'SELECT id, nome, email, telefone, salao_id, senha_hash FROM profissionais WHERE LOWER(email) = LOWER($1) AND app_ativo = true';
    if (salaoId) {
      params.push(salaoId);
      sql += ' AND salao_id = $2';
    }

    const result = await pool.query(sql, params);

    if (result.rows.length === 0)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    // [M4] Se mais de um profissional ativo com o mesmo email e salaoId não informado, exige escolha
    if (result.rows.length > 1 && !salaoId) {
      return res.status(409).json({
        success: false,
        error: 'Múltiplos salões para este email. Informe salaoId.',
        saloes: result.rows.map(r => ({ salaoId: r.salao_id, nome: r.nome }))
      });
    }

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
    return sendError(res, 500, 'Erro no login do profissional', error);
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
    return sendError(res, 500, 'Erro ao buscar profissional', error);
  }
});

// PUT /push-token
// [P3-B5] Valida formato de pushToken — só ExponentPushToken[...] ou FCM:...
router.put('/push-token', profissionalAuthMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (pushToken && typeof pushToken !== 'string') {
      return res.status(400).json({ success: false, error: 'pushToken inválido' });
    }
    if (pushToken && !/^ExponentPushToken\[.+\]$|^FCM:.+/i.test(pushToken)) {
      return res.status(400).json({ success: false, error: 'Formato de pushToken inválido' });
    }
    if (pushToken && pushToken.length > 256) {
      return res.status(400).json({ success: false, error: 'pushToken muito longo' });
    }
    await pool.query('UPDATE profissionais SET push_token = $1 WHERE id = $2', [pushToken || null, req.profissionalId]);
    res.json({ success: true });
  } catch (e) {
    return sendError(res, 500, 'Erro ao atualizar push token', e);
  }
});

module.exports = router;
