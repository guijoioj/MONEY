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

    // [P6-A1] BCRYPT FIRST — só depois decide se precisa escolha de salão.
    // Antes: early-return em rows.length>1 antes do bcrypt vazava lista de salões
    // ao atacante que digitava email correto + senha QUALQUER.
    // Agora: tenta autenticar contra TODOS os candidatos (constant-time via DUMMY_HASH
    // quando vazio). Só após uma match positiva considera enviar resposta.
    const DUMMY_HASH = '$2a$12$' + 'X'.repeat(53);
    const rows = result.rows.length ? result.rows : [{ senha_hash: DUMMY_HASH, _dummy: true }];

    // Roda bcrypt.compare contra cada candidato sequencialmente (timing fixo proporcional ao número de matches).
    const matches = [];
    for (const r of rows) {
      const hash = r.senha_hash || DUMMY_HASH;
      const ok = password ? await bcrypt.compare(password, hash) : false;
      if (ok && !r._dummy && r.senha_hash) matches.push(r);
    }

    if (matches.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    if (matches.length > 1 && !salaoId) {
      // Múltiplos profissionais com a MESMA senha (raríssimo) — só agora pedir salaoId.
      // Resposta inclui só salões cujas SENHAS conferem (não enumera outros vínculos).
      return res.status(409).json({
        success: false,
        error: 'Múltiplos salões para estas credenciais. Informe salaoId.',
        saloes: matches.map(r => ({ salaoId: r.salao_id, nome: r.nome }))
      });
    }

    const profissional = matches[0];
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
