const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    // [B9] Em produção não expõe versão (reduz fingerprint).
    // Em dev/test, lê do package.json para evitar drift.
    const isProd = process.env.NODE_ENV === 'production';
    const payload = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'running'
      }
    };
    if (!isProd) {
      try { payload.version = require('../../package.json').version; } catch { /* noop */ }
    }
    res.json(payload);
  } catch (error) {
    // [M1] Não vaza error.message; logs detalhados via console
    console.error('[HEALTH] DB error:', error.message);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Service degraded'
    });
  }
});

module.exports = router;
