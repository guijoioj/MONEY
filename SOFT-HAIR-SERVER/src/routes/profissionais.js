const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { ProfissionalService } = require('../services');
const { invalidateProfissionalCache } = require('../middleware/profissionalAuth');

const service = new ProfissionalService();

// [P3-A4] Whitelist explícita de campos editáveis em profissionais (impede mass-assignment).
// Campos NUNCA aceitos via body: id, salao_id, senha_hash (direto), usuario_id, created_at, push_token (vai por rota dedicada).
const PROFISSIONAL_ALLOWED_FIELDS = [
  'nome', 'email', 'telefone', 'cpf', 'especialidade', 'comissao_percentual', 'comissao',
  'ativo', 'foto_url', 'app_ativo', 'data_admissao', 'data_nascimento', 'endereco',
  'observacoes'
];

function pickAllowed(body, whitelist) {
  const out = {};
  for (const k of whitelist) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

// Listar profissionais
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { ativo, search } = req.query;
    const { query } = require('../config/database');
    const salaoId = req.salaoId;

    let conditions = ['salao_id = $1'];
    let params = [salaoId];
    let idx = 2;

    if (ativo !== undefined) { conditions.push(`ativo = $${idx++}`); params.push(ativo === 'true'); }
    if (search) {
      // [P3-M8] Escapa wildcards
      const safe = require('../utils/helpers').escapeLike(search);
      conditions.push(`(nome ILIKE $${idx} OR especialidade ILIKE $${idx})`);
      params.push(`%${safe}%`); idx++;
    }

    const rows = await query(
      `SELECT * FROM profissionais WHERE ${conditions.join(' AND ')} ORDER BY nome ASC`,
      params
    );
    const data = rows.rows || rows;
    res.json({ success: true, data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P2-C4] Criar profissional — exige admin (não-admins não podem criar/setar senha_app)
router.post('/', authMiddleware, requireAdmin, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('comissao_percentual').optional().isFloat({ min: 0, max: 100 }).withMessage('Comissão deve ser entre 0 e 100'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { senha_app } = req.body;
    // [P3-A4] Whitelist explícita: apenas campos permitidos vão pro service.
    const body = pickAllowed(req.body, PROFISSIONAL_ALLOWED_FIELDS);
    if (senha_app) {
      if (senha_app.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(senha_app)) {
        return res.status(400).json({ success: false, error: 'senha_app precisa de mínimo 8 caracteres, com letra e número' });
      }
      body.senha_hash = await bcrypt.hash(senha_app, 12);
      body.app_ativo = true;
    }
    const result = await service.criar(body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P2-C4] Atualizar — exige admin (impede reset de senha_app por outros usuários)
router.put('/:id', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { senha_app } = req.body;
    // [P3-A4] Whitelist explícita no UPDATE: jamais aceitar id/salao_id/usuario_id/senha_hash direto.
    const body = pickAllowed(req.body, PROFISSIONAL_ALLOWED_FIELDS);
    if (senha_app) {
      if (senha_app.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(senha_app)) {
        return res.status(400).json({ success: false, error: 'senha_app precisa de mínimo 8 caracteres, com letra e número' });
      }
      body.senha_hash = await bcrypt.hash(senha_app, 12);
      body.app_ativo = true;
    }
    const result = await service.atualizar(req.params.id, body, req.salaoId);
    if (result.success) {
      // [P7-M3] Se ativo/app_ativo mudou (incluindo via reset de senha_app), invalidar cache
      // do middleware para fechar a janela de até 2min onde token desativado ainda passaria.
      if (Object.prototype.hasOwnProperty.call(body, 'ativo') ||
          Object.prototype.hasOwnProperty.call(body, 'app_ativo')) {
        try { invalidateProfissionalCache(parseInt(req.params.id, 10) || req.params.id); } catch (_) { /* não-fatal */ }
      }
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P2-C4] Desativar — exige admin
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      // [P7-M3] Soft-delete desativa profissional — invalidar cache para fechar janela.
      try { invalidateProfissionalCache(parseInt(req.params.id, 10) || req.params.id); } catch (_) { /* não-fatal */ }
      res.json({ success: true, message: result.message || 'Profissional desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
