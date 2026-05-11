const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/authService');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Registrar novo salão
router.post('/register', [
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
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    console.error('Erro no login:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// Registrar dispositivo (apenas administradores do salão)
router.post('/device/register', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { salaoId, tipo, nome, fingerprint, info } = req.body;

    if (!fingerprint || !salaoId) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint e salaoId são obrigatórios'
      });
    }

    const device = await AuthService.registerDevice({
      salaoId,
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
    console.error('Erro ao registrar dispositivo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    res.status(401).json({
      success: false,
      error: error.message
    });
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
    console.error('Erro ao criar API Key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
