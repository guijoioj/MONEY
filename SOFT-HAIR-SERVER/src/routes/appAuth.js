const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { clienteAuthMiddleware, invalidateClienteCache } = require('../middleware/clienteAuth');

const crypto = require('crypto');
const signToken = (clienteId) =>
  jwt.sign(
    { clienteId, type: 'cliente', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

// POST /register
router.post('/register', [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('Senha precisa de mínimo 8 caracteres, com letra e número'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { nome, email, password, telefone } = req.body;

    const existing = await pool.query('SELECT id FROM clientes WHERE email = $1', [email]);
    if (existing.rows.length > 0)
      return res.status(409).json({ success: false, error: 'Email já cadastrado' });

    const senha_hash = await bcrypt.hash(password, 12);

    // [P5-A3] Catch UNIQUE violation por race condition (dois INSERTs paralelos com mesmo email).
    // Combinado com constraint uq_clientes_app_email (initDb runMigrations) — fecha a janela.
    let result;
    try {
      result = await pool.query(
        `INSERT INTO clientes (nome, email, telefone, senha_hash, app_ativo)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, nome, email, telefone`,
        [nome, email, telefone || null, senha_hash]
      );
    } catch (err) {
      // 23505 = unique_violation
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: 'Email já cadastrado' });
      }
      throw err;
    }

    const user = result.rows[0];
    const token = signToken(user.id);

    res.status(201).json({ success: true, data: { user, token } });
  } catch (error) {
    console.error('Erro no registro do cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// POST /login
// [B2] normalizeEmail evita criar contas duplicadas com casing diferente
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
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

    // [P4-M7] Constant-time: roda bcrypt.compare mesmo quando cliente não existe.
    const DUMMY_HASH = '$2a$12$' + 'X'.repeat(53);
    const cliente = result.rows[0];
    const hashToCompare = cliente?.senha_hash || DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!cliente)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    if (!cliente.senha_hash)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    if (!valid)
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

    const { senha_hash, ...user } = cliente;
    const token = signToken(user.id);

    res.json({ success: true, data: { user, token } });
  } catch (error) {
    console.error('Erro no login do cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
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
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// PUT /perfil
router.put('/perfil', clienteAuthMiddleware, [
  body('nome').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('telefone').optional(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { nome, telefone } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (nome !== undefined) { updates.push(`nome = $${idx++}`); values.push(nome); }
    if (telefone !== undefined) { updates.push(`telefone = $${idx++}`); values.push(telefone); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });

    values.push(req.clienteId);
    const result = await pool.query(
      `UPDATE clientes SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING id, nome, email, telefone`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar perfil do cliente:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// PUT /push-token
router.put('/push-token', clienteAuthMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    await pool.query('UPDATE clientes SET push_token = $1 WHERE id = $2', [pushToken, req.clienteId]);
    res.json({ success: true });
  } catch (e) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", e);
  }
});

// [P5-B6] LGPD/GDPR: cliente pode solicitar anonimização dos próprios dados pessoais.
// Soft-delete: app_ativo=false, dados PII anonimizados. Histórico (agendamentos, vendas)
// preservado para compliance fiscal (até 5 anos por nota fiscal BR).
router.delete('/me/delete-data', clienteAuthMiddleware, async (req, res) => {
  try {
    const { confirmacao } = req.body || {};
    if (confirmacao !== 'EXCLUIR_MEUS_DADOS') {
      return res.status(400).json({
        success: false,
        error: 'Para confirmar, envie { "confirmacao": "EXCLUIR_MEUS_DADOS" }'
      });
    }

    const result = await pool.query(
      `UPDATE clientes
         SET nome = 'Cliente Removido',
             email = NULL,
             telefone = NULL,
             cpf = NULL,
             endereco = NULL,
             foto_url = NULL,
             push_token = NULL,
             observacoes = NULL,
             senha_hash = NULL,
             data_nascimento = NULL,
             app_ativo = false,
             ativo = false,
             updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [req.clienteId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    // Audit log
    try {
      const { logAction } = require('../utils/auditLog');
      await logAction({
        req,
        action: 'cliente.lgpd_delete',
        entityType: 'cliente',
        entityId: req.clienteId,
        actorId: req.clienteId,
        actorType: 'cliente',
      });
    } catch (_) { /* não bloqueia */ }

    // [P6-A5] Revogar JWT atual — adiciona jti à blacklist para que o token
    // não consiga mais autenticar até expirar naturalmente.
    try {
      const authHeader = req.headers.authorization || '';
      const [, token] = authHeader.split(' ');
      if (token) {
        const AuthService = require('../services/authService');
        await AuthService.revokeToken(token);
      }
    } catch (_) { /* não bloqueia */ }

    // [P7-M3] Invalidar cache do middleware imediatamente para fechar a janela
    // de 2min em que o status app_ativo cacheado ainda poderia ser true.
    try { invalidateClienteCache(req.clienteId); } catch (_) { /* não bloqueia */ }

    res.json({
      success: true,
      message: 'Dados pessoais anonimizados. Histórico fiscal preservado por exigência legal.'
    });
  } catch (e) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", e);
  }
});

module.exports = router;
