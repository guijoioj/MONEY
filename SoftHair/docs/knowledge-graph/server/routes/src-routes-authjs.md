# src/routes/auth.js

**Repository:** Server
**File:** `src/routes/auth.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/routes/auth.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/security|security]]
- [[domains/api|api]]

- [[server/entities/authservice-ad9c3659|AuthService]]
- [[server/entities/server-05c102bd|Server]]
- [[server/entities/authmiddleware-362f3741|authMiddleware]]
- [[server/entities/express-7a42f4f0|express]]
- [[server/entities/express-validator-9943c6b3|express-validator]]
- [[server/entities/requireadmin-89a4f2c8|requireAdmin]]

## Arquivos Relacionados

- [[server/config/src-config-initdbjs|src/config/initDb.js]]
- [[server/root/src-middleware-authjs|src/middleware/auth.js]]
- [[server/routes/src-routes-agendamentosjs|src/routes/agendamentos.js]]
- [[server/routes/src-routes-atendimentosjs|src/routes/atendimentos.js]]
- [[server/routes/src-routes-clientesjs|src/routes/clientes.js]]
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
const AuthService = require('../services/authService');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Registrar novo salão
router.post('/register', [
  body('nome').notEmpty().withMessage('Nome do salão é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('adminEmail').isEmail().withMessage('Email do admin inválido'),
  body('adminSenha').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('adminNome').notEmpty().withMessage('Nome do admin é obrigatório'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await AuthService.registerSalao(req.body);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, senha } = req.body;
    const result = await AuthService.login(email, senha);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// Registrar dispositivo (para clientes mobile/desktop)
router.post('/device/register', async (req, res) => {
  try {
    const { salaoId, tipo, nome, fingerprint, info } = req.body;

    if (!fingerprint || !salaoId) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint e salaoId são obrigatórios'
      });
    }

    const device = await AuthService.registerDevice({
      salaoId,
      tipo,
      nome,
      fingerprint,
      info
    });

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    console.error('Erro ao registrar dispositivo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Validar dispositivo
router.post('/device/validate', async (req, res) => {
  try {
    const { fingerprint } = req.body;

    if (!fingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint é obrigatório'
      });
    }

    const device = await AuthService.validateDevice(fingerprint);

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// Criar API Key (apenas admin)
router.post('/apikey', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { nome, permissoes, expiresAt } = req.body;

    const apiKey = await AuthService.createApiKey({
      salaoId: req.salaoId,
      nome,
      permissoes,
      expiresAt
    });

    res.status(201).json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('Erro ao criar API Key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Me (informações do usuário logado)
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: req.user || req.device
  });
});

module.exports = router;
```
