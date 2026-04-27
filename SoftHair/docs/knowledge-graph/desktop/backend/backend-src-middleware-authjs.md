# backend/src/middleware/auth.js

**Repository:** Desktop
**File:** `backend/src/middleware/auth.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/middleware/auth.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/sync|sync]]
- [[domains/security|security]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const AuthService = require('../services/authService');
const SecurityService = require('../services/securityService');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Token não fornecido' });

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) return res.status(401).json({ success: false, error: 'Token inválido' });

    const isRevoked = await SecurityService.isTokenRevoked(token);
    if (isRevoked) {
      await SecurityService.logSecurityEvent({
        type: 'TOKEN_REVOKED',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        endpoint: req.path,
        method: req.method,
        statusCode: 401,
        message: 'Tentativa de uso de token revogado',
      });
      return res.status(401).json({ success: false, error: 'Token revogado' });
    }

    const decoded = AuthService.verifyToken(token);
    const userId = decoded.userId || decoded.id;

    const userResult = await AuthService.getUserById(userId);
    if (!userResult || userResult.bloqueado) {
      await SecurityService.logSecurityEvent({
        type: 'BLOCKED_USER_ACCESS',
        userId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        endpoint: req.path,
        method: req.method,
        statusCode: 403,
        message: 'Tentativa de acesso de usuário bloqueado',
      });
      return res.status(403).json({ success: false, error: 'Usuário bloqueado' });
    }

    req.user = { ...decoded, userId };
    req.salonId = decoded.salonId;
    next();
  } catch (error) {
    await SecurityService.logSecurityEvent({
      type: 'INVALID_TOKEN',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      endpoint: req.path,
      method: req.method,
      statusCode: 401,
      message: error.message,
    });
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');
      if (bearer === 'Bearer' && token) {
        const isRevoked = await SecurityService.isTokenRevoked(token);
        if (!isRevoked) {
          const decoded = AuthService.verifyToken(token);
          const userId = decoded.userId || decoded.id;
          req.user = { ...decoded, userId };
          req.salonId = decoded.salonId;
        }
      }
    }
    next();
  } catch {
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };
```
