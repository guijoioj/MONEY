# src/routes/saloes.js

**Repository:** Server
**File:** `src/routes/saloes.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/saloes.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

- [[server/entities/server-05c102bd|Server]]
- [[server/entities/authmiddleware-362f3741|authMiddleware]]
- [[server/entities/express-7a42f4f0|express]]
- [[server/entities/query-6626406b|query]]
- [[mobile/entities/router-8b412a3e|router]]
- [[server/entities/salaoid-fdc8ed5e|salaoId]]

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
- [[server/routes/src-routes-healthjs|src/routes/health.js]]
- [[server/routes/src-routes-notificacoesjs|src/routes/notificacoes.js]]
- [[server/routes/src-routes-produtosjs|src/routes/produtos.js]]
- [[server/routes/src-routes-profissionaisjs|src/routes/profissionais.js]]
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
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// Buscar dados do salão atual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const salao = await queryOne('SELECT * FROM saloes WHERE id = $1', [req.salaoId]);
    if (!salao) return res.status(404).json({ success: false, error: 'Salão não encontrado' });
    res.json({ success: true, data: salao });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar salão atual
router.put('/me', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }),
  body('email').optional().isEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { nome, endereco, telefone, email, cnpj, logo_url, config } = req.body;
    const result = await queryOne(`
      UPDATE saloes SET
        nome = COALESCE($1, nome), endereco = COALESCE($2, endereco),
        telefone = COALESCE($3, telefone), email = COALESCE($4, email),
        cnpj = COALESCE($5, cnpj), logo_url = COALESCE($6, logo_url),
        config = COALESCE($7, config), updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [nome, endereco, telefone, email, cnpj, logo_url, config ? JSON.stringify(config) : null, req.salaoId]);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```
