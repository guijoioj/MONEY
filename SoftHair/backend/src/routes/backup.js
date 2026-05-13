/**
 * Backup local (P4-C6).
 *
 * Implementa o mínimo para o user fazer snapshot do SQLite local:
 *  - POST /api/backup/create — copia local.db para userData/SoftHair/backups/
 *  - GET  /api/backup/local  — lista backups disponíveis
 *  - POST /api/backup/restore/:filename — restaura backup (com backup do estado atual antes)
 *  - GET  /api/backup/google/* — stubbed: ainda não disponível no desktop
 *
 * Não implementa Google Drive (stub responde 501 sem auth dance).
 * Backup automático diário pode ser plugado via syncService.scheduleBackup.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { dbType, rawClient } = require('../config/database');

const DATA_DIR =
  process.env.SOFTHAIR_DATA_DIR || path.join(__dirname, '..', '..', 'database');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function safeFilename(name) {
  // Allowlist: alfa/dig/. /-/_ apenas; .db sufixo obrigatório
  if (typeof name !== 'string') return null;
  if (!/^softhair-[0-9TZ\-:.]+\.db$/.test(name)) return null;
  return name;
}

/**
 * Backup do SQLite via better-sqlite3 `db.backup()`.
 * Para Postgres, retorna 501 (deve ser feito via pg_dump no servidor).
 */
async function createBackup() {
  if (dbType !== 'sqlite') {
    const err = new Error('Backup local só disponível para SQLite');
    err.statusCode = 501;
    throw err;
  }
  ensureBackupsDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `softhair-${ts}.db`;
  const dest = path.join(BACKUPS_DIR, filename);
  // better-sqlite3 expõe db.backup(destination) que é online backup (sem
  // lock global de leitura). Async no driver mas seguro.
  await rawClient.backup(dest);
  return { filename, path: dest, size: fs.statSync(dest).size };
}

// P5-A7: backup automático diário com retention de 7 dias.
// Cron simples (setInterval 1h) que dispara backup se último é >24h atrás.
// Roda apenas para SQLite e fora de testes.
function pruneOldBackups(maxKeep = 7) {
  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const full = path.join(BACKUPS_DIR, f);
        return { name: f, full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const file of files.slice(maxKeep)) {
      try { fs.unlinkSync(file.full); } catch (_) { /* skip */ }
    }
  } catch (e) {
    console.warn('[backup] pruneOldBackups falhou:', e.message);
  }
}

function startAutomaticBackup() {
  if (dbType !== 'sqlite') return;
  if (process.env.NODE_ENV === 'test') return;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const TARGET_INTERVAL_MS = 24 * ONE_HOUR_MS;
  const tick = async () => {
    try {
      ensureBackupsDir();
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter((f) => f.endsWith('.db'))
        .map((f) => fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs)
        .sort((a, b) => b - a);
      const latest = files[0] || 0;
      if (Date.now() - latest >= TARGET_INTERVAL_MS) {
        console.log('[backup] Disparando backup automático diário...');
        await createBackup();
        pruneOldBackups(7);
      }
    } catch (e) {
      console.warn('[backup] backup automático falhou:', e.message);
    }
  };
  // Roda 30s após boot (dá tempo do server inicializar) e depois a cada hora.
  setTimeout(tick, 30 * 1000);
  setInterval(tick, ONE_HOUR_MS);
}

// Inicia o cron no require do módulo — chamado uma vez por boot do backend.
startAutomaticBackup();

router.post('/create', authMiddleware, async (req, res) => {
  try {
    const result = await createBackup();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
});

router.get('/local', authMiddleware, (req, res) => {
  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const full = path.join(BACKUPS_DIR, f);
        const st = fs.statSync(full);
        return { filename: f, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ success: true, data: files });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/restore/:filename', authMiddleware, async (req, res) => {
  try {
    if (dbType !== 'sqlite') {
      return res.status(501).json({ success: false, error: 'Restore local só disponível para SQLite' });
    }
    const filename = safeFilename(req.params.filename);
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Nome de arquivo inválido' });
    }
    const src = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(src)) {
      return res.status(404).json({ success: false, error: 'Backup não encontrado' });
    }
    // Backup automático do estado atual antes de restaurar
    const safetyBackup = await createBackup();
    // Restore: o db.backup() é one-way (copy); para restaurar, fecha o handle
    // atual e copia o arquivo por cima. O server precisará reiniciar para
    // remontar o handle (em prod o Electron faz fork novo).
    const dbPath = path.join(DATA_DIR, 'local.db');
    try { rawClient.close(); } catch (_) { /* noop */ }
    fs.copyFileSync(src, dbPath);
    res.json({
      success: true,
      message: 'Backup restaurado. Reinicie o aplicativo para aplicar.',
      data: { restored: filename, safetyBackup: safetyBackup.filename, requiresRestart: true },
    });
    // Forçar exit para que o Electron remonte o backend com o DB novo.
    setTimeout(() => process.exit(0), 1500);
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
});

// Stubs Google Drive — não implementado no desktop standalone.
router.get('/google/status', authMiddleware, (req, res) => {
  res.json({ success: true, data: { connected: false, available: false, message: 'Backup em nuvem não disponível no app desktop. Use backup local.' } });
});

router.get('/cloud', authMiddleware, (req, res) => {
  res.json({ success: true, data: [] });
});

router.get('/google/files', authMiddleware, (req, res) => {
  res.json({ success: true, data: [] });
});

router.get('/google/auth-url', authMiddleware, (req, res) => {
  res.status(501).json({ success: false, error: 'Backup em nuvem não disponível no app desktop.' });
});

router.post('/google/callback', authMiddleware, (req, res) => {
  res.status(501).json({ success: false, error: 'Backup em nuvem não disponível no app desktop.' });
});

router.post('/google/sync/:filename', authMiddleware, (req, res) => {
  res.status(501).json({ success: false, error: 'Backup em nuvem não disponível no app desktop.' });
});

router.get('/google/config', authMiddleware, (req, res) => {
  res.json({ success: true, data: {} });
});

router.post('/google/config', authMiddleware, (req, res) => {
  res.status(501).json({ success: false, error: 'Backup em nuvem não disponível no app desktop.' });
});

router.get('/google/disconnect', authMiddleware, (req, res) => {
  res.json({ success: true, data: { disconnected: true } });
});

module.exports = router;
