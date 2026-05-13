const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const syncService = require('../services/syncService');

router.get('/status', authMiddleware, (req, res) => {
  res.json({ success: true, data: syncService.getStatus() });
});

router.post('/configure', authMiddleware, (req, res) => {
  const { cloudUrl, token, enabled } = req.body;
  syncService.configure({ cloudUrl, token, enabled });
  res.json({ success: true, data: syncService.getStatus() });
});

router.post('/now', authMiddleware, async (req, res) => {
  const result = await syncService.syncNow();
  res.json({ success: result.success !== false, data: { ...result, ...syncService.getStatus() } });
});

router.post('/login-cloud', authMiddleware, async (req, res) => {
  // Atalho: autentica direto no cloud e armazena token sem precisar copy-paste
  const { cloudUrl, email, senha } = req.body;
  if (!cloudUrl || !email || !senha) {
    return res.status(400).json({ success: false, error: 'cloudUrl, email e senha obrigatórios' });
  }
  try {
    const axios = require('axios');
    const r = await axios.post(
      `${cloudUrl}/auth/login`,
      { email, senha },
      { timeout: 15000 }
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
