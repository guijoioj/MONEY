const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { ProdutoService } = require('../services');

const service = new ProdutoService();

// Listar produtos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { ativo, search, categoria } = req.query;
    const filtros = {};
    if (ativo !== undefined) filtros.ativo = ativo === 'true';
    if (search) filtros.termo = search;
    if (categoria) filtros.categoria = categoria;

    const result = await service.listar(req.salaoId, filtros);
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Produtos com estoque baixo
router.get('/estoque-baixo', authMiddleware, async (req, res) => {
  try {
    const result = await service.estoqueBaixo(req.salaoId);
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

// Criar
router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('preco_venda').isFloat({ min: 0 }).withMessage('Preço de venda deve ser positivo'),
  body('quantidade_estoque').optional().isInt({ min: 0 }).withMessage('Estoque deve ser inteiro positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.criar(req.body, req.salaoId);
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
  body('nome').optional().isLength({ min: 2 }),
  body('preco_venda').optional().isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.atualizar(req.params.id, req.body, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Desativar
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message || 'Produto desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
