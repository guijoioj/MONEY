require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const helmet = require('helmet');
const BootstrapService = require('./services/bootstrapService');
const SecurityInitService = require('./services/securityInitService');
const { initDb } = require('./config/initDb');
const ws = require('./services/websocketService');
const {
  apiKeyMiddleware,
  hmacMiddleware,
  generalLimiter,
  authLimiter,
  speedLimiter,
  forceHttps,
  validateTokenIntegrity,
  corsOptions,
} = require('./middleware/security');

const app = express();

if (process.env.FORCE_HTTPS === 'true') {
  app.use(forceHttps);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateTokenIntegrity);

app.use('/api/auth', generalLimiter, authLimiter, speedLimiter);
app.use('/api', generalLimiter, speedLimiter);

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/clientes',      require('./routes/clientes'));
app.use('/api/servicos',      require('./routes/servicos'));
app.use('/api/produtos',      require('./routes/produtos'));
app.use('/api/profissionais', require('./routes/profissionais'));
app.use('/api/agendamentos',  require('./routes/agendamentos'));
app.use('/api/vendas',        require('./routes/vendas'));
app.use('/api/atendimentos',  require('./routes/atendimentos'));
app.use('/api/fechamentos',   require('./routes/fechamentos'));
app.use('/api/backup',        require('./routes/backup'));
app.use('/api/configuracoes', require('./routes/configuracoes'));
app.use('/api/notificacoes',  require('./routes/notificacoes'));
app.use('/api/historico',     require('./routes/historico'));
app.use('/api/creditos',      require('./routes/creditos'));
app.use('/api/comissoes',     require('./routes/comissoes'));

app.use('/api/app', apiKeyMiddleware, hmacMiddleware);
app.use('/api/app/auth',         require('./routes/app/auth'));
app.use('/api/app/pedidos',      require('./routes/app/pedidos'));
app.use('/api/app/loja',         require('./routes/app/loja'));
app.use('/api/app/profissional', require('./routes/app/profissional'));
app.use('/api/app/cliente',      require('./routes/app/cliente'));
app.use('/api/app/security',     require('./routes/app/security'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    // Inicializar banco de dados
    await initDb();

    // Inicializar camadas de segurança automaticamente
    await SecurityInitService.initializeSecurity();

    BootstrapService.ensureRuntimeEnvironment();
    await BootstrapService.ensureDefaultAdmin();

    let server;

    if (process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true') {
      try {
        const privateKey = fs.readFileSync('/etc/ssl/private/softhair.key', 'utf8');
        const certificate = fs.readFileSync('/etc/ssl/certs/softhair.crt', 'utf8');
        const ca = fs.readFileSync('/etc/ssl/certs/softhair-ca.crt', 'utf8');

        server = https.createServer({
          key: privateKey,
          cert: certificate,
          ca: ca,
          secureOptions: require('crypto').constants.SSL_OP_NO_TLSv1 | require('crypto').constants.SSL_OP_NO_TLSv1_1,
        }, app);
      } catch (sslError) {
        console.warn('Certificado SSL não encontrado, usando HTTP:', sslError.message);
        server = http.createServer(app);
      }
    } else {
      server = http.createServer(app);
    }

    ws.init(server);

    server.listen(PORT, async () => {
      const protocol = process.env.FORCE_HTTPS === 'true' ? 'https' : 'http';
      console.log(`🚀 Servidor rodando em ${protocol}://localhost:${PORT}`);
      console.log(`📡 WebSocket disponível em ws${process.env.FORCE_HTTPS === 'true' ? 's' : ''}://localhost:${PORT}/ws`);
      console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏱️  Rate limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS || 100} requisições por ${(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 60000} minutos`);

      // Exibir status de segurança
      const securityStatus = await SecurityInitService.getSecurityStatus();
      if (securityStatus) {
        console.log('📊 Status de Segurança (últimas 24h):');
        console.log(`   - Logs: ${securityStatus.logs_24h}`);
        console.log(`   - Tentativas falhas: ${securityStatus.failed_logins_24h}`);
        console.log(`   - Dispositivos ativos: ${securityStatus.active_devices}`);
        console.log(`   - Usuários bloqueados: ${securityStatus.blocked_users}`);
      }
    });
  } catch (err) {
    console.error('Erro ao iniciar servidor:', err);
    process.exit(1);
  }
})();

module.exports = app;
