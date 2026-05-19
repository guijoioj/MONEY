/**
 * Aggregator de rotas v2.
 *
 * Estrutura:
 *   /api/v2/comissoes              ← comissoes.js
 *   /api/v2/comissoes/regras       ← regrasComissao.js
 *   /api/v2/comissoes/ajustes      ← ajustesComissao.js
 *
 * IMPORTANTE: registrar SUB-routers ANTES do router pai (express resolve
 * por ordem). Ex: /regras antes do GET /:id catch-all em comissoes.js.
 */

const express = require('express');
const router = express.Router();

// Sub-rotas (mais específicas primeiro)
router.use('/comissoes/regras', require('./regrasComissao'));
router.use('/comissoes/ajustes', require('./ajustesComissao'));

// Rota principal de comissões (catch-all GET /:id por último)
router.use('/comissoes', require('./comissoes'));

module.exports = router;
