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

// ─── Security Middleware ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// ─── CORS ───
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ─── Body Parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ───
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
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
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// ─── Rate Limiting (auth — mais restritivo) ───
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success: false, error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes ───
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/app/auth', authLimiter, require('./routes/appAuth'));
app.use('/api/app/profissional/auth', authLimiter, require('./routes/appProfissionalAuth'));
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
app.use('/api/backup', require('./routes/backup'));
app.use('/api/sync', require('./routes/sync'));

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`
  });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  res.status(err.status || 500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── Start Server ───
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    // Initialize Database
    const { initDb } = require('./config/initDb');
    await initDb();

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