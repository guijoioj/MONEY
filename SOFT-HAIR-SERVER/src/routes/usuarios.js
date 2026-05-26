/**
 * Rotas /api/usuarios — gerenciamento de usuários do sistema (admin-only).
 *
 * Perfis suportados:
 *   - 'admin'        → acesso total
 *   - 'recepcao'     → operação de salão
 *   - 'profissional' → escopo limitado ao próprio profissional_id
 *
 * Segurança:
 *   - Todas as rotas exigem authMiddleware + requireRole('admin').
 *   - Admin não pode rebaixar a si mesmo (defense-in-depth).
 *   - Senha sempre armazenada como bcrypt cost 12.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { requireRole, VALID_ROLES } = require('../middleware/role');
const { pool, query, queryOne } = require('../config/database');

const BCRYPT_COST = 12;
const allAdmins = requireRole('admin');

/** Lista usuários do salão atual */
router.get('/', authMiddleware, allAdmins, async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.id, u.email, u.nome, u.tipo, u.profissional_id, u.ativo,
              u.ultimo_acesso, u.created_at,
              p.nome AS profissional_nome
         FROM usuarios u
         LEFT JOIN profissionais p ON p.id = u.profissional_id
        WHERE u.salao_id = $1
        ORDER BY u.tipo, u.nome`,
      [req.salaoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao listar usuários', error);
  }
});

/** Buscar usuário por id (do mesmo salão) */
router.get('/:id', authMiddleware, allAdmins, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.email, u.nome, u.tipo, u.profissional_id, u.ativo,
              u.ultimo_acesso, u.created_at,
              p.nome AS profissional_nome
         FROM usuarios u
         LEFT JOIN profissionais p ON p.id = u.profissional_id
        WHERE u.id = $1 AND u.salao_id = $2`,
      [req.params.id, req.salaoId]
    );
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    res.json({ success: true, data: user });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao buscar usuário', error);
  }
});

/** Criar usuário */
router.post('/', authMiddleware, allAdmins, [
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('nome').isLength({ min: 2 }).withMessage('Nome obrigatório (mín 2 chars)'),
  body('tipo').isIn(VALID_ROLES).withMessage(`Tipo deve ser: ${VALID_ROLES.join(', ')}`),
  body('senha').isLength({ min: 6 }).withMessage('Senha mínimo 6 caracteres'),
  body('profissional_id').optional({ nullable: true }).isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, nome, tipo, senha, profissional_id, ativo } = req.body;

    // Profissional precisa de profissional_id válido do mesmo salão.
    if (tipo === 'profissional') {
      if (!profissional_id) {
        return res.status(400).json({ success: false, error: 'profissional_id obrigatório para tipo=profissional' });
      }
      const prof = await queryOne(
        'SELECT id FROM profissionais WHERE id = $1 AND salao_id = $2',
        [profissional_id, req.salaoId]
      );
      if (!prof) return res.status(400).json({ success: false, error: 'profissional_id não pertence ao salão' });
    }

    // Email único no salão
    const dup = await queryOne(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND salao_id = $2',
      [email, req.salaoId]
    );
    if (dup) return res.status(409).json({ success: false, error: 'Email já cadastrado neste salão' });

    const senha_hash = await bcrypt.hash(senha, BCRYPT_COST);
    const created = await queryOne(
      `INSERT INTO usuarios (email, nome, tipo, senha_hash, salao_id, profissional_id, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
       RETURNING id, email, nome, tipo, profissional_id, ativo, created_at`,
      [email, nome, tipo, senha_hash, req.salaoId, tipo === 'profissional' ? profissional_id : null, ativo]
    );
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao criar usuário', error);
  }
});

/** Atualizar usuário (não inclui senha — endpoint separado) */
router.put('/:id', authMiddleware, allAdmins, [
  body('nome').optional().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('tipo').optional().isIn(VALID_ROLES),
  body('profissional_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('ativo').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const current = await queryOne(
      'SELECT id, tipo FROM usuarios WHERE id = $1 AND salao_id = $2',
      [id, req.salaoId]
    );
    if (!current) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    // Admin não pode rebaixar a si mesmo nem se desativar
    const meId = req.user.userId || req.user.id;
    if (meId && Number(meId) === id) {
      if (req.body.tipo && req.body.tipo !== 'admin') {
        return res.status(400).json({ success: false, error: 'Você não pode rebaixar seu próprio usuário' });
      }
      if (req.body.ativo === false) {
        return res.status(400).json({ success: false, error: 'Você não pode desativar seu próprio usuário' });
      }
    }

    // Se vai virar profissional, validar profissional_id
    const targetTipo = req.body.tipo || current.tipo;
    let profIdNorm = req.body.profissional_id;
    if (targetTipo === 'profissional') {
      if (profIdNorm === undefined) profIdNorm = null;
      if (!profIdNorm) {
        return res.status(400).json({ success: false, error: 'profissional_id obrigatório para tipo=profissional' });
      }
      const prof = await queryOne(
        'SELECT id FROM profissionais WHERE id = $1 AND salao_id = $2',
        [profIdNorm, req.salaoId]
      );
      if (!prof) return res.status(400).json({ success: false, error: 'profissional_id não pertence ao salão' });
    } else {
      profIdNorm = null; // limpa vínculo se não for profissional
    }

    // Email único (se mudou)
    if (req.body.email) {
      const dup = await queryOne(
        'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND salao_id = $2 AND id != $3',
        [req.body.email, req.salaoId, id]
      );
      if (dup) return res.status(409).json({ success: false, error: 'Email já cadastrado neste salão' });
    }

    const updated = await queryOne(
      `UPDATE usuarios
          SET nome  = COALESCE($1, nome),
              email = COALESCE($2, email),
              tipo  = COALESCE($3, tipo),
              profissional_id = $4,
              ativo = COALESCE($5, ativo),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND salao_id = $7
        RETURNING id, email, nome, tipo, profissional_id, ativo`,
      [req.body.nome, req.body.email, req.body.tipo, profIdNorm,
       req.body.ativo, id, req.salaoId]
    );

    // Invalida cache admin do middleware/auth
    try { require('../middleware/auth').invalidateAdminCache(id); } catch (_) { /* noop */ }

    res.json({ success: true, data: updated });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao atualizar usuário', error);
  }
});

/** Trocar senha de um usuário (admin agindo sobre outro user, ou sobre si mesmo) */
router.put('/:id/senha', authMiddleware, allAdmins, [
  body('senha').isLength({ min: 6 }).withMessage('Senha mínimo 6 caracteres'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const user = await queryOne('SELECT id FROM usuarios WHERE id = $1 AND salao_id = $2', [id, req.salaoId]);
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const senha_hash = await bcrypt.hash(req.body.senha, BCRYPT_COST);
    await query(
      `UPDATE usuarios SET senha_hash = $1, token_version = COALESCE(token_version,0)+1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND salao_id = $3`,
      [senha_hash, id, req.salaoId]
    );
    res.json({ success: true, message: 'Senha alterada. Tokens antigos revogados.' });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao alterar senha', error);
  }
});

/** Desativar (soft) — DELETE não remove, apenas marca ativo=false */
router.delete('/:id', authMiddleware, allAdmins, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const meId = req.user.userId || req.user.id;
    if (meId && Number(meId) === id) {
      return res.status(400).json({ success: false, error: 'Você não pode desativar seu próprio usuário' });
    }

    const result = await queryOne(
      `UPDATE usuarios SET ativo = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND salao_id = $2
        RETURNING id`,
      [id, req.salaoId]
    );
    if (!result) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    try { require('../middleware/auth').invalidateAdminCache(id); } catch (_) { /* noop */ }
    res.json({ success: true, message: 'Usuário desativado' });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao desativar usuário', error);
  }
});

module.exports = router;
