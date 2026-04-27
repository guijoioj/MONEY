# src/routes/creditos.js

**Repository:** Server
**File:** `src/routes/creditos.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/creditos.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/security|security]]
- [[domains/api|api]]

- [[server/entities/get-request-97fb5b07|GET request]]
- [[server/entities/server-05c102bd|Server]]
- [[server/entities/authmiddleware-362f3741|authMiddleware]]
- [[server/entities/express-7a42f4f0|express]]
- [[server/entities/query-6626406b|query]]

## Arquivos Relacionados

- [[server/config/src-config-initdbjs|src/config/initDb.js]]
- [[server/root/src-middleware-authjs|src/middleware/auth.js]]
- [[server/routes/src-routes-agendamentosjs|src/routes/agendamentos.js]]
- [[server/routes/src-routes-atendimentosjs|src/routes/atendimentos.js]]
- [[server/routes/src-routes-authjs|src/routes/auth.js]]
- [[server/routes/src-routes-clientesjs|src/routes/clientes.js]]
- [[server/routes/src-routes-comissoesjs|src/routes/comissoes.js]]
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
const { CreditoService } = require('../services');

const service = new CreditoService();

router.get('/cliente/:clienteId', authMiddleware, async (req, res) => {
  try {
    const result = await service.listarPorCliente(req.params.clienteId, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id obrigatório'),
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser positivo'),
  body('tipo').isIn(['credito', 'uso']).withMessage('Tipo deve ser credito ou uso'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { cliente_id, valor, tipo, observacoes } = req.body;
    const result = await service.adicionar(cliente_id, valor, tipo, observacoes, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data, message: result.message });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```
