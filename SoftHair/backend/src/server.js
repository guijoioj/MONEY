/**
 * Backend embarcado SoftHair.
 *
 * Default: SQLite local (./database/local.db).
 * Opcional: PostgreSQL (DATABASE_TYPE=postgres + DATABASE_URL).
 *
 * Roda como child process do Electron em produção, ou standalone em dev.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { initDb } = require('./config/initDb');
const syncService = require('./services/syncService');

const app = express();

// ── Security ──
app.use(
  helmet({
    contentSecurityPolicy: false, // app desktop, sem necessidade
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ── (permissivo: app desktop / dev)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logger simples ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
      const dt = Date.now() - start;
      console.log(`[${req.method}] ${req.originalUrl} ${res.statusCode} ${dt}ms`);
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

// COMISSÕES OFFLINE BLOQUEADAS — operação financeira não tolera regras
// desatualizadas. Retorna 503 explícito; frontend mostra banner.
// (Veja docs/comissoes-v2/COMISSOES-V2-DESIGN.md §2 — decisão "Opção B")
app.use('/api/comissoes', (req, res) => {
  res.status(503).json({
    success: false,
    error: 'comissoes_offline_indisponivel',
    message: 'Comissões exigem conexão com o servidor central. Modo offline não calcula nem persiste comissões.',
    docs: 'https://github.com/guijoioj/MONEY/blob/main/SOFT-HAIR-SERVER/docs/comissoes-v2/COMISSOES-V2-DESIGN.md',
  });
});
// Idem pra v2
app.use('/api/v2/comissoes', (req, res) => {
  res.status(503).json({
    success: false,
    error: 'comissoes_offline_indisponivel',
    message: 'Comissões exigem conexão com o servidor central.',
  });
});

// Stub para endpoints ainda não portados — sempre retorna array vazio.
// Evita 404 em telas legadas.
['notificacoes', 'fechamentos', 'creditos', 'historico', 'saloes', 'backup'].forEach((rota) => {
  app.use(`/api/${rota}`, (req, res) => {
    if (req.method === 'GET') {
      if (rota === 'notificacoes' && req.path === '/count') {
        return res.json({ success: true, naoLidas: 0 });
      }
      if (rota === 'saloes' && req.path === '/me') {
        return res.json({ success: true, data: { id: 1, nome: 'Meu Salão' } });
      }
      return res.json({ success: true, data: [] });
    }
    res.json({ success: true, message: 'stub - rota não implementada localmente' });
  });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(err.status || 500).json({ success: false, error: err.message });
});

// ── Boot ──
const PORT = parseInt(process.env.PORT) || 3001;
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
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
