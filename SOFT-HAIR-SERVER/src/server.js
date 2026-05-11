require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

// ─── Trust Proxy (Render/load balancer) ───
app.set('trust proxy', 1);

// ─── Security Middleware ───
// CSP endurecida; [A1]: ainda permite 'unsafe-inline' em styleSrc (TailwindCSS gera inline runtime).
// Tokens estão em localStorage no frontend — risco de XSS mitigado com CSP estrita aqui.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// ─── CORS ───
// SECURITY: nunca aceitar wildcard '*' junto com credentials:true (vide [C5]).
// Em produção, exigir lista explícita de origins. Em dev sem lista, aceitar tudo SEM credentials.
const _allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)) || [];
const _hasWildcard = _allowedOrigins.includes('*');
if (_hasWildcard && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  [SECURITY] ALLOWED_ORIGINS contém "*" em produção — credentials será DESABILITADO.');
}
const _useCredentials = !_hasWildcard;

const corsOptions = {
  origin: (origin, callback) => {
    // Requisições server-side (curl, mobile sem Origin) — permitidas; auth ainda é exigida nas rotas.
    if (!origin) return callback(null, true);
    if (_hasWildcard) return callback(null, true);
    if (_allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: _useCredentials,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ─── Body Parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ───
// Sanitiza URL para não logar tokens em query string ([M2])
function sanitizeUrl(originalUrl) {
  try {
    const u = new URL(originalUrl, 'http://x');
    const sensitive = ['token', 'access_token', 'refresh_token', 'apikey', 'api_key', 'password', 'senha'];
    for (const k of sensitive) {
      if (u.searchParams.has(k)) u.searchParams.set(k, '[REDACTED]');
    }
    return u.pathname + (u.search || '');
  } catch {
    return originalUrl;
  }
}
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${sanitizeUrl(req.originalUrl)} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 400) {
      console.error(log);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(log);
    }
  });
  next();
});

// ─── Rate Limiting (geral) ───
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: { success: false, error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// ─── Rate Limiting (auth — mais restritivo) ───
// [A7] Limite por IP: 5/15min. Bloqueio progressivo por usuário (email) feito em accountLockout.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: { success: false, error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lockout por email/usuário: 3 falhas nos últimos 30min → bloqueia 30min.
// Usa a tabela login_attempts que já é criada em securityInitService.
const { pool: _authPool } = require('./config/database');
async function accountLockout(req, res, next) {
  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    if (!email) return next();
    const lockoutWindowMin = 30;
    const maxFails = 3;
    const lockoutMin = 30;

    // Conta tentativas falhas nos últimos lockoutWindowMin minutos
    const r = await _authPool.query(
      `SELECT COUNT(*)::int AS fails, MAX(created_at) AS last_fail
         FROM login_attempts
        WHERE LOWER(email) = $1
          AND sucesso = false
          AND created_at > NOW() - INTERVAL '${lockoutWindowMin} minutes'`,
      [email]
    );
    const fails = r.rows[0]?.fails || 0;
    const lastFail = r.rows[0]?.last_fail;
    if (fails >= maxFails && lastFail) {
      const unlockAt = new Date(new Date(lastFail).getTime() + lockoutMin * 60_000);
      if (unlockAt > new Date()) {
        return res.status(429).json({
          success: false,
          error: `Conta bloqueada por ${lockoutMin}min após ${maxFails} tentativas falhas. Tente novamente após ${unlockAt.toISOString()}.`
        });
      }
    }
    next();
  } catch (e) {
    // Falha de DB não deve bloquear login legítimo — apenas loga.
    console.error('[accountLockout] erro:', e.message);
    next();
  }
}

// Registra tentativa de login (sucesso/falha) — chamado após auth resolver
async function recordLoginAttempt(email, sucesso, ip) {
  try {
    if (!email) return;
    await _authPool.query(
      `INSERT INTO login_attempts (email, ip, sucesso) VALUES ($1, $2, $3)`,
      [email.toLowerCase().trim(), ip || null, !!sucesso]
    );
  } catch (e) {
    console.error('[recordLoginAttempt] erro:', e.message);
  }
}

// Wrap as routes que processam credenciais
function loginAttemptLogger(req, res, next) {
  const email = (req.body?.email || '').toLowerCase().trim();
  const ip = req.ip;
  // Intercepta o status code da resposta — 2xx = sucesso, 4xx = falha
  const origStatus = res.status.bind(res);
  let statusCode = 200;
  res.status = (code) => { statusCode = code; return origStatus(code); };
  res.on('finish', () => {
    // Apenas registra POSTs /login (resto pode ignorar)
    if (req.method === 'POST' && /\/login\b/.test(req.originalUrl || '')) {
      recordLoginAttempt(email, statusCode >= 200 && statusCode < 300, ip);
    }
  });
  next();
}

app.locals.accountLockout = accountLockout;
app.locals.loginAttemptLogger = loginAttemptLogger;

// ─── Camelize: snake_case → camelCase em todas as respostas JSON ───
const { camelizeResponse } = require('./middleware/camelize');
app.use(camelizeResponse);

// ─── Routes ───
// authLimiter + lockout + logger aplicados APENAS aos endpoints sensíveis (login/register/password),
// não no resto do router /auth (/me, /apikey, /device/* etc).
const _authSensitive = (req, res, next) => {
  const p = req.path || '';
  if (/^\/(login|register|profissional\/login)\b/.test(p) || /\/senha\b/.test(p)) {
    return authLimiter(req, res, (e) => {
      if (e) return next(e);
      return accountLockout(req, res, () => loginAttemptLogger(req, res, next));
    });
  }
  next();
};

app.use('/api/health', require('./routes/health'));
app.use('/api/auth', _authSensitive, require('./routes/auth'));
app.use('/api/app/auth', _authSensitive, require('./routes/appAuth'));
app.use('/api/app/legacy/auth', _authSensitive, require('./routes/app/auth'));
app.use('/api/app/cliente', require('./routes/app/cliente'));
app.use('/api/app/pedidos', require('./routes/app/pedidos'));
app.use('/api/app/loja', require('./routes/app/loja'));
app.use('/api/app/profissional/auth', _authSensitive, require('./routes/appProfissionalAuth'));
app.use('/api/app/profissional', require('./middleware/profissionalAuth').profissionalAuthMiddleware, require('./routes/appProfissional'));
app.use('/api/saloes', require('./routes/saloes'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/profissionais', require('./routes/profissionais'));
app.use('/api/servicos', require('./routes/servicos'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/atendimentos', require('./routes/atendimentos'));
app.use('/api/comissoes', require('./routes/comissoes'));
app.use('/api/fechamentos', require('./routes/fechamentos'));
app.use('/api/creditos', require('./routes/creditos'));
app.use('/api/notificacoes', require('./routes/notificacoes'));
app.use('/api/configuracoes', require('./routes/configuracoes'));
app.use('/api/historico', require('./routes/historico'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/despesas', require('./routes/despesas'));
app.use('/api/financeiro', require('./routes/financeiro'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/bloqueios', require('./routes/bloqueios'));
app.use('/api/caixa', require('./routes/caixa'));
app.use('/api/metas', require('./routes/metas'));
app.use('/api/relatorios', require('./routes/relatorios'));
app.use('/api/fidelidade', require('./routes/fidelidade'));

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`
  });
});

// ─── Error Handler ───
// [A6] Em produção: NUNCA expor err.message/stack ao cliente.
app.use((err, req, res, next) => {
  const correlationId = require('crypto').randomBytes(8).toString('hex');
  console.error(`[SERVER ERROR][${correlationId}] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    success: false,
    error: 'Erro interno do servidor',
    correlationId,
    message: isProd ? undefined : err.message
  });
});

// ─── Start Server ───
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    // Initialize Database
    const { initDb, runMigrations } = require('./config/initDb');
    await initDb();
    await runMigrations();

    // Initialize Security
    const SecurityInitService = require('./services/securityInitService');
    await SecurityInitService.initializeSecurity();

    let server;

    // HTTPS or HTTP
    if (process.env.FORCE_HTTPS === 'true' && process.env.SSL_KEY_PATH && fs.existsSync(process.env.SSL_KEY_PATH)) {
      const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
      const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
      const ca = process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)
        ? fs.readFileSync(process.env.SSL_CA_PATH, 'utf8')
        : undefined;

      server = https.createServer({ key: privateKey, cert: certificate, ca }, app);
    } else {
      server = http.createServer(app);
    }

    // WebSocket
    if (process.env.WS_ENABLED === 'true') {
      const wsService = require('./services/websocketService');
      wsService.init(server);
    }

    server.listen(PORT, () => {
      const protocol = process.env.FORCE_HTTPS === 'true' ? 'https' : 'http';
      console.log(`🚀 SOFT-HAIR-SERVER v${require('../package.json').version} rodando em ${protocol}://localhost:${PORT}`);
      console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Segurança: Ativada | Rate Limit Auth: ${process.env.AUTH_RATE_LIMIT_MAX || 10}/15min`);
      console.log(`📊 WebSocket: ${process.env.WS_ENABLED === 'true' ? 'Ativo' : 'Desativado'}`);
    });

    // ─── Graceful Shutdown ───
    const gracefulShutdown = async (signal) => {
      console.log(`\n⏳ ${signal} recebido. Encerrando graciosamente...`);

      server.close(async () => {
        console.log('✅ HTTP server fechado');

        try {
          const { pool } = require('./config/database');
          await pool.end();
          console.log('✅ Pool de banco fechado');
        } catch (err) {
          console.error('❌ Erro ao fechar pool:', err.message);
        }

        console.log('👋 Servidor encerrado com sucesso');
        process.exit(0);
      });

      // Forçar saída após 10s
      setTimeout(() => {
        console.error('❌ Timeout de graceful shutdown. Forçando saída.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
})();

module.exports = app;
