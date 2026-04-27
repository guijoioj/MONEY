const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Configuração dos headers para segurança
const securityHeadersMiddleware = (req, res, next) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: https:; frame-ancestors 'none'; object-src 'none';");
  
  // HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Cache-Control para dados sensíveis
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  // Remove headers de versão que podem expor informações
  res.removeHeader('X-Powered-By');
  
  next();
};

// Rate limiter para autenticação
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'), // 5 tentativas por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de autenticação. Tente novamente mais tarde.',
    retryAfter: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000') / 1000
  },
  keyGenerator: (req) => {
    // Usa IP + user agent para evitar bloqueio de usuários diferentes no mesmo IP
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    return crypto.createHash('md5').update(ip + ua).digest('hex');
  }
});

// Rate limiter geral
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});

// Rate limiter de velocidade
const speedLimiter = rateLimit({
  windowMs: 1000, // 1 segundo
  max: 10, // 10 requisições por segundo
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de velocidade excedido.' }
});

// Middleware para forçar HTTPS em produção
const forceHttps = (req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.FORCE_HTTPS === 'true') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
};

// Valida integridade do token JWT
const validateTokenIntegrity = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Validação básica de formato do token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    
    // Verifica se o token não tem caracteres inválidos
    if (!/^[A-Za-z0-9-_]+$/.test(token)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  }
  
  next();
};

// Configurações de CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS não permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-HMAC-Signature'],
  maxAge: 86400
};

module.exports = {
  securityHeadersMiddleware,
  authLimiter,
  generalLimiter,
  speedLimiter,
  forceHttps,
  validateTokenIntegrity,
  corsOptions
};
