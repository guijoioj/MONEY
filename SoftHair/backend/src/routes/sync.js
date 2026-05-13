const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const syncService = require('../services/syncService');

router.get('/status', authMiddleware, (req, res) => {
  res.json({ success: true, data: syncService.getStatus() });
});

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

// E9: disconnect endpoint — limpa cloudUrl, token, lastSync
router.post('/disconnect', authMiddleware, (req, res) => {
  syncService.disconnect();
  res.json({ success: true, data: syncService.getStatus() });
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
