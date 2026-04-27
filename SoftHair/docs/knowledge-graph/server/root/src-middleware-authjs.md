# src/middleware/auth.js

**Repository:** Server
**File:** `src/middleware/auth.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/middleware/auth.js` do repositório Server.

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

- [[server/entities/server-05c102bd|Server]]

## Arquivos Relacionados

- [[server/config/src-config-initdbjs|src/config/initDb.js]]
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
- [[server/routes/src-routes-saloesjs|src/routes/saloes.js]]
- [[server/routes/src-routes-servicosjs|src/routes/servicos.js]]
- [[server/routes/src-routes-syncjs|src/routes/sync.js]]
- [[server/routes/src-routes-vendasjs|src/routes/vendas.js]]
- [[server/root/src-scripts-migratejs|src/scripts/migrate.js]]
- [[server/root/src-serverjs|src/server.js]]

## Conteudo

```javascript
const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    const deviceFingerprint = req.headers['x-device-fingerprint'];

    // Tentar autenticação por JWT
    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');
      if (bearer === 'Bearer' && token) {
        const decoded = AuthService.verifyToken(token);
        req.user = decoded;
        req.salaoId = decoded.salaoId;
        return next();
      }
    }

    // Tentar autenticação por API Key
    if (apiKey) {
      const keyData = await AuthService.validateApiKey(apiKey);
      req.apiKey = keyData;
      req.salaoId = keyData.salao_id;
      return next();
    }

    // Tentar autenticação por Device (para clientes mobile/desktop)
    if (deviceFingerprint) {
      const device = await AuthService.validateDevice(deviceFingerprint);
      req.device = device;
      req.salaoId = device.salao_id;
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária'
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Token inválido'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    const deviceFingerprint = req.headers['x-device-fingerprint'];

    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');
      if (bearer === 'Bearer' && token) {
        const decoded = AuthService.verifyToken(token);
        req.user = decoded;
        req.salaoId = decoded.salaoId;
      }
    } else if (apiKey) {
      const keyData = await AuthService.validateApiKey(apiKey);
      req.apiKey = keyData;
      req.salaoId = keyData.salao_id;
    } else if (deviceFingerprint) {
      const device = await AuthService.validateDevice(deviceFingerprint);
      req.device = device;
      req.salaoId = device.salao_id;
    }

    next();
  } catch {
    next();
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
    });
  }
  next();
};

module.exports = { authMiddleware, optionalAuth, requireAdmin };
```
