# src/routes/comissoes.js

**Repository:** Server
**File:** `src/routes/comissoes.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/comissoes.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/profissionais|profissionais]]
- [[domains/produtos|produtos]]
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
- [[server/entities/salaoid-fdc8ed5e|salaoId]]

## Arquivos Relacionados

- [[server/routes/src-routes-servicosjs|src/routes/servicos.js]]
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
const { authMiddleware } = require('../middleware/auth');
const { ComissaoService } = require('../services');

const service = new ComissaoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { profissional_id, pago, data_inicio, data_fim } = req.query;
    const result = await service.listar(req.salaoId, { profissional_id, pago, data_inicio, data_fim });
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/resumo/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ success: false, error: 'data_inicio e data_fim obrigatórios' });
    const result = await service.resumoPorProfissional(req.salaoId, req.params.profissionalId, data_inicio, data_fim);
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const result = await service.criar(req.body, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/pagar', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarComoPaga(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data, message: result.message });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```
