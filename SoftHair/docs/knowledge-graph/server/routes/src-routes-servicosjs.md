# src/routes/servicos.js

**Repository:** Server
**File:** `src/routes/servicos.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/servicos.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/servicos|servicos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]

- [[server/entities/atualizar-03bf482c|Atualizar]]
- [[server/entities/criar-4718e5b5|Criar]]
- [[server/entities/deletar-9ab807a4|Deletar]]
- [[server/entities/listar-1e488a95|Listar]]
- [[server/entities/server-05c102bd|Server]]
- [[server/entities/authmiddleware-362f3741|authMiddleware]]
- [[server/entities/express-7a42f4f0|express]]
- [[server/entities/query-6626406b|query]]
- [[mobile/entities/router-8b412a3e|router]]

## Arquivos Relacionados

- [[server/routes/src-routes-comissoesjs|src/routes/comissoes.js]]
- [[server/config/src-config-initdbjs|src/config/initDb.js]]
- [[server/root/src-middleware-authjs|src/middleware/auth.js]]
- [[server/routes/src-routes-agendamentosjs|src/routes/agendamentos.js]]
- [[server/routes/src-routes-atendimentosjs|src/routes/atendimentos.js]]
- [[server/routes/src-routes-authjs|src/routes/auth.js]]
- [[server/routes/src-routes-clientesjs|src/routes/clientes.js]]
- [[server/routes/src-routes-creditosjs|src/routes/creditos.js]]
- [[server/routes/src-routes-fechamentosjs|src/routes/fechamentos.js]]
- [[server/routes/src-routes-healthjs|src/routes/health.js]]
- [[server/routes/src-routes-notificacoesjs|src/routes/notificacoes.js]]
- [[server/routes/src-routes-produtosjs|src/routes/produtos.js]]
- [[server/routes/src-routes-profissionaisjs|src/routes/profissionais.js]]
- [[server/routes/src-routes-saloesjs|src/routes/saloes.js]]
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
const { ServicoService } = require('../services');

const service = new ServicoService();

// Listar serviços
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

// Criar serviço
router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('preco').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo'),
  body('duracao_minutos').optional().isInt({ min: 1 }).withMessage('Duração deve ser em minutos'),
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
  body('preco').optional().isFloat({ min: 0 }),
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
      res.json({ success: true, message: result.message || 'Serviço desativado' });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```
