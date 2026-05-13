/**
 * Backend embarcado SoftHair.
 *
 * Default: SQLite local (./database/local.db).
 * Opcional: PostgreSQL (DATABASE_TYPE=postgres + DATABASE_URL).
 *
 * Roda como child process do Electron em produção, ou standalone em dev.
 *
 * Pass 1 fixes:
 *   - E7: CORS restrito a origens locais conhecidas (não `origin: true`)
 *   - E12: bind explícito em 127.0.0.1 (HOST default = '127.0.0.1')
 *   - E13: helmet com CSP básica habilitada
 *   - E22: logger nunca imprime body
 *   - E23: stub responde 501 e exige auth
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { initDb } = require('./config/initDb');
const syncService = require('./services/syncService');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// ── Security ──
// E13 + P4-C5 + P4-M1: CSP defesa em profundidade.
//   - removido wildcard `https://*.onrender.com` em connectSrc (era amplificador
//     de XSS exfil — qualquer subdomain onrender.com hospedaria payload)
//   - adicionado `frame-ancestors 'none'` para mitigar clickjacking
//   - backend embarcado só serve JSON API; renderer Electron tem CSP própria
//     em frontend/index.html
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'http://127.0.0.1:*'],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// P2-A5: anti-DNS-rebinding. Aceita só Host loopback. Bloqueia simple requests
// que tentem alcançar 127.0.0.1 via DNS rebinding (`evil.com` → 127.0.0.1).
const ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
]);
app.use((req, res, next) => {
  // req.hostname já normaliza porta. `req.headers.host` tem `host:port`.
  const host = req.hostname || '';
  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(421).json({
      success: false,
      error: 'Misdirected Request — host header inválido',
    });
  }
  next();
});

// ── CORS ── (E7: restrito a origens locais/electron file://)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Electron file:// envia origin = null/undefined — permitido.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (origin === 'file://') return callback(null, true);
      return callback(new Error('Origin não permitido'), false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logger simples ──
// E22: nunca loga body, redacta urls com query sensível.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
      const dt = Date.now() - start;
      // Redact possíveis tokens em querystring
      const safeUrl = req.originalUrl.replace(/(token|senha|password)=[^&]+/gi, '$1=<redacted>');
      console.log(`[${req.method}] ${safeUrl} ${res.statusCode} ${dt}ms`);
    }
  });
  next();
});

// ── Rotas ──
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/profissionais', require('./routes/profissionais'));
app.use('/api/servicos', require('./routes/servicos'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/atendimentos', require('./routes/atendimentos'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/sync', require('./routes/sync'));
// P4-C6: backup local implementado (mínimo: create / list / restore SQLite).
app.use('/api/backup', require('./routes/backup'));

// Stub para endpoints ainda não portados.
// E23 + P4-M6: stubs sinalizam `stub: true` para UI mostrar banner "em desenvolvimento"
// em vez de "lista vazia". Apenas exceções (notificacoes/count, saloes/me) retornam
// dados reais para não quebrar componentes que dependem deles.
['notificacoes', 'fechamentos', 'comissoes', 'creditos', 'historico', 'saloes'].forEach((rota) => {
  app.use(`/api/${rota}`, authMiddleware, (req, res) => {
    if (req.method === 'GET') {
      if (rota === 'notificacoes' && req.path === '/count') {
        return res.json({ success: true, naoLidas: 0 });
      }
      if (rota === 'saloes' && req.path === '/me') {
        return res.json({ success: true, data: { id: 1, nome: 'Meu Salão' } });
      }
      // P4-M6: flag stub para UI mostrar aviso "em desenvolvimento"
      return res.json({ success: true, data: [], stub: true, message: `Funcionalidade ${rota} em desenvolvimento na versão desktop` });
    }
    return res
      .status(501)
      .json({ success: false, error: `Rota ${rota} não implementada localmente` });
  });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  const safe = process.env.NODE_ENV === 'production' ? 'Erro interno' : err.message;
  res.status(err.status || 500).json({ success: false, error: safe });
});

// ── Boot ──
const PORT = parseInt(process.env.PORT) || 3001;
// E12: forçar 127.0.0.1 como default — nunca 0.0.0.0
const HOST = process.env.HOST || '127.0.0.1';

try {
  initDb();
} catch (e) {
  console.error('[BOOT] Falha ao inicializar DB:', e);
  process.exit(1);
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[BOOT] SoftHair backend embarcado em http://${HOST}:${PORT}`);
  console.log(`[BOOT] DB: ${require('./config/database').dbType}`);
  console.log(`[BOOT] Sync: ${syncService.getStatus().enabled ? 'ATIVO' : 'desativado'}`);
});

// ── Graceful shutdown ──
function shutdown(signal) {
  console.log(`[SHUTDOWN] ${signal} recebido`);
  syncService.stop();
  server.close(() => {
    console.log('[SHUTDOWN] HTTP fechado');
    // E10: fechar handle do SQLite explicitamente antes de sair
    try {
      const { rawClient, dbType: dbtp } = require('./config/database');
      if (dbtp === 'sqlite' && rawClient && typeof rawClient.close === 'function') {
        rawClient.close();
      }
    } catch (_) { /* noop */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
