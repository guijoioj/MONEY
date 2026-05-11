const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/authService');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { sendError } = require('../utils/sendError');

// [P4-A6] Rate limit dedicado para criação de salões: 5 registros/dia POR IP.
// Sem este limit, o keyGenerator de `authLimiter` (IP+email) produz chave única por
// tentativa quando o atacante itera email, anulando o rate limit padrão. Permitimos
// 5/dia para acomodar smoke tests e onboarding legítimo.
const registerLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24h
  max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 5,
  message: { success: false, error: 'Limite diário de registros excedido. Tente novamente amanhã.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  // Em ambiente de teste, NODE_ENV='test' libera (smoke usa runId único; sem isso, falha).
  skip: () => process.env.NODE_ENV === 'test',
});

// Registrar novo salão
router.post('/register', registerLimiter, [
  body('nome').notEmpty().withMessage('Nome do salão é obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('adminEmail').isEmail().normalizeEmail().withMessage('Email do admin inválido'),
  body('adminSenha')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('Senha precisa de mínimo 8 caracteres, com letra e número'),
  body('adminNome').notEmpty().withMessage('Nome do admin é obrigatório'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await AuthService.registerSalao(req.body);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendError(res, 500, 'Erro ao registrar salão', error);
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, senha } = req.body;
    const result = await AuthService.login(email, senha);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendError(res, 401, 'Credenciais inválidas', error);
  }
});

// Registrar dispositivo (apenas administradores do salão)
// [P3-C1] salaoId vem do JWT do admin autenticado — NUNCA do body. Impede escalada cross-tenant
// (admin do salão A não pode criar device para salão B).
router.post('/device/register', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { tipo, nome, fingerprint, info } = req.body;

    if (!fingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint é obrigatório'
      });
    }

    // [P3-C1] Se o body trouxe salaoId, exigir que bata com o do JWT. Ignora caso contrário.
    if (req.body.salaoId !== undefined && Number(req.body.salaoId) !== Number(req.salaoId)) {
      return res.status(403).json({
        success: false,
        error: 'salaoId do body diverge do salão do usuário autenticado'
      });
    }

    const device = await AuthService.registerDevice({
      salaoId: req.salaoId, // [P3-C1] força tenant do JWT
      tipo,
      nome,
      fingerprint,
      info
    });

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    return sendError(res, 500, 'Erro ao registrar dispositivo', error);
  }
});

// Validar dispositivo
router.post('/device/validate', async (req, res) => {
  try {
    const { fingerprint } = req.body;

    if (!fingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint é obrigatório'
      });
    }

    const device = await AuthService.validateDevice(fingerprint);

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    return sendError(res, 401, 'Dispositivo inválido', error);
  }
});

// Criar API Key (apenas admin)
router.post('/apikey', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { nome, permissoes, expiresAt } = req.body;

    const apiKey = await AuthService.createApiKey({
      salaoId: req.salaoId,
      nome,
      permissoes,
      expiresAt
    });

    res.status(201).json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    return sendError(res, 500, 'Erro ao criar API Key', error);
  }
});

// Me (informações do usuário logado)
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: req.user || req.device
  });
});

// Logout — revoga o JWT atual via blacklist
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (req.user) {
      await AuthService.revokeToken(req.user);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ success: false, error: 'Erro ao revogar token' });
  }
});

module.exports = router;
