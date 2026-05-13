const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const syncService = require('../services/syncService');
const { query, queryOne, queryRun } = require('../config/database');

router.get('/status', authMiddleware, (req, res) => {
  res.json({ success: true, data: syncService.getStatus() });
});

// P5-C4: conflitos pendentes — count + listagem para a UI de sync revisar.
router.get('/conflicts', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, tabela, registro_id, local_updated_at, remote_updated_at,
              local_data, remote_data, resolved, detected_at, resolved_at
       FROM sync_conflicts
       WHERE resolved = 0
       ORDER BY detected_at DESC
       LIMIT 200`,
      []
    );
    const total = await queryOne(`SELECT COUNT(*) as n FROM sync_conflicts WHERE resolved = 0`, []);
    res.json({
      success: true,
      data: {
        pending: Number(total?.n || 0),
        conflicts: (rows || []).map((r) => ({
          id: r.id,
          tabela: r.tabela,
          registro_id: r.registro_id,
          local_updated_at: r.local_updated_at,
          remote_updated_at: r.remote_updated_at,
          local: safeParse(r.local_data),
          remote: safeParse(r.remote_data),
          detected_at: r.detected_at,
        })),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/conflicts/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const choice = String(req.body?.choice || '');
    // 1=mantida_local (descartar remoto), 2=aplicar_remoto (sobrescrever local)
    if (!['local', 'remote'].includes(choice)) {
      return res.status(400).json({ success: false, error: 'choice deve ser "local" ou "remote"' });
    }
    const conflict = await queryOne(`SELECT * FROM sync_conflicts WHERE id = ?`, [id]);
    if (!conflict || conflict.resolved) {
      return res.status(404).json({ success: false, error: 'Conflito não encontrado ou já resolvido' });
    }
    if (choice === 'remote') {
      const remote = safeParse(conflict.remote_data);
      if (remote && remote.id) {
        await syncService.upsertRowForce(conflict.tabela, remote);
      }
    }
    await queryRun(
      `UPDATE sync_conflicts
       SET resolved = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
      [choice === 'local' ? 1 : 2, id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

function safeParse(s) {
  if (!s) return null;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}

router.post('/configure', authMiddleware, (req, res) => {
  const { cloudUrl, token, enabled } = req.body;
  try {
    syncService.configure({ cloudUrl, token, enabled });
    res.json({ success: true, data: syncService.getStatus() });
  } catch (e) {
    // E3: configure pode lançar INVALID_CLOUD_URL
    return res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/now', authMiddleware, async (req, res) => {
  const result = await syncService.syncNow();
  res.json({ success: result.success !== false, data: { ...result, ...syncService.getStatus() } });
});

// E9 + P5-A10: disconnect endpoint — limpa cloudUrl, token, lastSync.
// Agora awaits para garantir que sync em progresso terminou antes de responder.
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    await syncService.disconnect();
    res.json({ success: true, data: syncService.getStatus() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/login-cloud', authMiddleware, async (req, res) => {
  // Atalho: autentica direto no cloud e armazena token sem precisar copy-paste
  const { cloudUrl, email, senha } = req.body;
  if (!cloudUrl || !email || !senha) {
    return res.status(400).json({ success: false, error: 'cloudUrl, email e senha obrigatórios' });
  }
  // E3: validar HTTPS antes de tentar login
  if (!syncService.constructor && !require('../services/syncService').isValidCloudUrl) {
    // fallback se import falhar — não bloqueia mas registra
  }
  const isValid = require('../services/syncService').isValidCloudUrl;
  if (isValid && !isValid(cloudUrl)) {
    return res.status(400).json({
      success: false,
      error: 'cloudUrl deve usar HTTPS (ou loopback em dev)',
    });
  }
  try {
    const axios = require('axios');
    const https = require('https');
    const r = await axios.post(
      `${cloudUrl}/auth/login`,
      { email, senha },
      {
        timeout: 15000,
        // E3: rejeitar certs inválidos
        httpsAgent: new https.Agent({ rejectUnauthorized: true }),
      }
    );
    const token = r.data?.data?.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Login cloud falhou' });
    }
    syncService.configure({ cloudUrl, token, enabled: true });
    res.json({ success: true, data: syncService.getStatus() });
  } catch (error) {
    res.status(401).json({ success: false, error: error.response?.data?.error || error.message });
  }
});

module.exports = router;
