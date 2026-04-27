# backend/src/middleware/security.js

**Repository:** Desktop
**File:** `backend/src/middleware/security.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/middleware/security.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/security|security]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'API Key inválida' });
  }
  next();
};

const hmacMiddleware = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  if (!timestamp || !signature) {
    return res.status(401).json({ success: false, error: 'Assinatura HMAC ausente' });
  }

  const now = Date.now();
  const timestampNum = parseInt(timestamp);

  if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300000) {
    return res.status(401).json({ success: false, error: 'Timestamp inválido' });
  }

  const payload = JSON.stringify(req.body);
  const message = `${req.method}:${req.path}:${timestamp}:${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.HMAC_SECRET)
    .update(message)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ success: false, error: 'Assinatura HMAC inválida' });
  }

  next();
};

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, error: 'Muitas requisições, tente novamente mais tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: { success: false, error: 'Muitas tentativas de login, tente novamente em 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
  maxDelayMs: 20000,
});

const forceHttps = (req, res, next) => {
  if (process.env.FORCE_HTTPS === 'true' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};

const validateTokenIntegrity = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.iat || !decoded.exp) {
      return res.status(401).json({ success: false, error: 'Token JWT inválido' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return res.status(401).json({ success: false, error: 'Token expirado' });
    }

    if (decoded.iat > now) {
      return res.status(401).json({ success: false, error: 'Token com data futura' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token malformado ou inválido' });
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (origin && allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (!origin && process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = {
  apiKeyMiddleware,
  hmacMiddleware,
  generalLimiter,
  authLimiter,
  speedLimiter,
  forceHttps,
  validateTokenIntegrity,
  corsOptions,
};
```
