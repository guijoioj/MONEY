const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { ProfissionalService } = require('../services');

const service = new ProfissionalService();

// Listar profissionais
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { ativo, search } = req.query;
    const filtros = {};
    if (ativo !== undefined) filtros.ativo = ativo === 'true';
    if (search) filtros.termo = search;

    const result = await service.listar(req.salaoId, filtros);
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar profissional
router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('comissao_percentual').optional().isFloat({ min: 0, max: 100 }).withMessage('Comissão deve ser entre 0 e 100'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { senha_app, ...body } = req.body;
    if (senha_app && senha_app.length >= 6) {
      body.senha_hash = await bcrypt.hash(senha_app, 10);
      body.app_ativo = true;
    }
    const result = await service.criar(body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar
router.put('/:id', authMiddleware, [
  body('nome').optional().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { senha_app, ...body } = req.body;
    if (senha_app && senha_app.length >= 6) {
      body.senha_hash = await bcrypt.hash(senha_app, 10);
      body.app_ativo = true;
    }
    const result = await service.atualizar(req.params.id, body, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Desativar (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message || 'Profissional desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
