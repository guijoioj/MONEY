const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { ClienteService } = require('../services');

const clienteService = new ClienteService();

// Listar clientes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, ativo, page = 1, limit = 500 } = req.query;
    const salaoId = req.salaoId;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let filtros = {};
    if (ativo !== undefined) filtros.ativo = ativo === 'true';
    if (search) filtros.termo = search;

    const result = await clienteService.listar(salaoId, filtros, { limit: parseInt(limit), offset, orderBy: 'nome', order: 'ASC' });
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter cliente por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.buscarPorId(id, salaoId);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar cliente
router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('telefone').optional().isMobilePhone('pt-BR').withMessage('Telefone inválido'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('cpf').optional().isLength({ min: 11, max: 14 }).withMessage('CPF deve ter entre 11 e 14 caracteres'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const salaoId = req.salaoId;
    
    const result = await clienteService.criar(req.body, salaoId);

    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar cliente
router.put('/:id', authMiddleware, [
  body('nome').optional().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('telefone').optional().isMobilePhone('pt-BR').withMessage('Telefone inválido'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.atualizar(id, req.body, salaoId);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deletar cliente (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.deletar(id, salaoId);

    if (result.success) {
      res.json({ success: true, message: result.message || 'Cliente desativado com sucesso' });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar clientes por termo (nome, telefone ou email)
router.get('/search/:termo', authMiddleware, async (req, res) => {
  try {
    const { termo } = req.params;
    const salaoId = req.salaoId;

    const result = await clienteService.buscarPorTermo(termo, salaoId, 20);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Adicionar crédito ao cliente
router.put('/:id/credito', authMiddleware, [
  body('valor').isFloat({ min: 0 }).withMessage('Valor deve ser um número positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const salaoId = req.salaoId;
    const { valor } = req.body;

    const result = await clienteService.adicionarCredito(id, valor, salaoId);

    if (result.success) {
      res.json({ success: true, data: result.data, message: result.message });
    } else if (result.error.includes('não encontrado')) {
      res.status(404).json({ success: false, error: result.error });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao adicionar crédito:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;