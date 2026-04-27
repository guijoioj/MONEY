# src/routes/clientes.js

**Repository:** Server
**File:** `src/routes/clientes.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/clientes.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]

- [[server/entities/clienteservice-88122a3c|ClienteService]]
- [[server/entities/server-05c102bd|Server]]
- [[server/entities/authmiddleware-362f3741|authMiddleware]]
- [[server/entities/express-7a42f4f0|express]]
- [[server/entities/express-validator-9943c6b3|express-validator]]

## Arquivos Relacionados

- [[server/config/src-config-initdbjs|src/config/initDb.js]]
- [[server/root/src-middleware-authjs|src/middleware/auth.js]]
- [[server/routes/src-routes-agendamentosjs|src/routes/agendamentos.js]]
- [[server/routes/src-routes-atendimentosjs|src/routes/atendimentos.js]]
- [[server/routes/src-routes-authjs|src/routes/auth.js]]
- [[server/routes/src-routes-comissoesjs|src/routes/comissoes.js]]
- [[server/routes/src-routes-creditosjs|src/routes/creditos.js]]
- [[server/routes/src-routes-fechamentosjs|src/routes/fechamentos.js]]
- [[server/routes/src-routes-healthjs|src/routes/health.js]]
- [[server/routes/src-routes-notificacoesjs|src/routes/notificacoes.js]]
- [[server/routes/src-routes-produtosjs|src/routes/produtos.js]]
- [[server/routes/src-routes-profissionaisjs|src/routes/profissionais.js]]
- [[server/routes/src-routes-saloesjs|src/routes/saloes.js]]
- [[server/routes/src-routes-servicosjs|src/routes/servicos.js]]
- [[server/routes/src-routes-syncjs|src/routes/sync.js]]
- [[server/routes/src-routes-vendasjs|src/routes/vendas.js]]
- [[server/root/src-scripts-migratejs|src/scripts/migrate.js]]
- [[server/root/src-serverjs|src/server.js]]

## Conteudo

```javascript
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { ClienteService } = require('../services');

const clienteService = new ClienteService();

// Listar clientes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, ativo, page = 1, limit = 50 } = req.query;
    const salaoId = req.salaoId;

    let filtros = {};
    if (ativo !== undefined) filtros.ativo = ativo === 'true';
    if (search) filtros.termo = search;

    const result = await clienteService.listar(salaoId, filtros);
    
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
```
