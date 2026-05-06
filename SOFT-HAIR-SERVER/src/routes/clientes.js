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
    if (search) filtros._search = search;

    const result = await clienteService.listar(salaoId, filtros, { limit: parseInt(limit), offset });
    
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

// Clientes inadimplentes (vendas pendentes/abertas)
router.get('/inadimplentes', authMiddleware, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const r = await query(`
      SELECT c.id, c.nome, c.telefone, c.email,
        COALESCE(SUM(v.valor_final),0) as total_devido,
        COUNT(v.id) as qtd_vendas_abertas,
        MAX(v.created_at) as ultima_venda
      FROM clientes c
      JOIN vendas v ON v.cliente_id = c.id
      WHERE c.salao_id = $1
        AND v.status IN ('pendente','aberto')
        AND v.salao_id = $1
      GROUP BY c.id, c.nome, c.telefone, c.email
      HAVING SUM(v.valor_final) > 0
      ORDER BY total_devido DESC
    `, [req.salaoId]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// Aniversariantes da semana
router.get('/aniversariantes', authMiddleware, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const r = await query(`
      SELECT id, nome, telefone, email, data_nascimento,
        EXTRACT(DAY FROM data_nascimento) as dia,
        EXTRACT(MONTH FROM data_nascimento) as mes
      FROM clientes
      WHERE salao_id = $1
        AND data_nascimento IS NOT NULL
        AND ativo = true
        AND (
          EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM data_nascimento) BETWEEN
            EXTRACT(DAY FROM CURRENT_DATE) AND
            EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '7 days')
        )
      ORDER BY EXTRACT(DAY FROM data_nascimento)
    `, [req.salaoId]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;