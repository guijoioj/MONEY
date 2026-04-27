# src/routes/health.js

**Repository:** Server
**File:** `src/routes/health.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/health.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

- [[server/entities/server-05c102bd|Server]]
- [[server/entities/express-7a42f4f0|express]]

## Arquivos Relacionados

- [[server/config/src-config-initdbjs|src/config/initDb.js]]
- [[server/root/src-middleware-authjs|src/middleware/auth.js]]
- [[server/routes/src-routes-agendamentosjs|src/routes/agendamentos.js]]
- [[server/routes/src-routes-atendimentosjs|src/routes/atendimentos.js]]
- [[server/routes/src-routes-authjs|src/routes/auth.js]]
- [[server/routes/src-routes-clientesjs|src/routes/clientes.js]]
- [[server/routes/src-routes-comissoesjs|src/routes/comissoes.js]]
- [[server/routes/src-routes-creditosjs|src/routes/creditos.js]]
- [[server/routes/src-routes-fechamentosjs|src/routes/fechamentos.js]]
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
const { pool } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
```
