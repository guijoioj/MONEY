const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// [P6-M4] /health público: APENAS status ok|degraded|down.
// Pool stats, memória e latência são info-disclosure pra reconnaissance — movidos
// para /health/detailed protegido por admin.
router.get('/', async (req, res) => {
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - t0;
    const degraded =
      (pool.idleCount === 0 && pool.waitingCount > 0) ||
      dbLatencyMs > 5000;
    res.status(degraded ? 503 : 200).json({
      success: !degraded,
      status: degraded ? 'degraded' : 'healthy'
    });
  } catch (error) {
    console.error('[HEALTH] DB error:', error.message);
    res.status(503).json({
      success: false,
      status: 'down'
    });
  }
});

// [P6-M4] Health detalhado — apenas admin
router.get('/detailed', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - t0;

    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };

    const mem = process.memoryUsage();
    const memInfo = {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    };

    const degraded =
      (poolStats.idle === 0 && poolStats.waiting > 0) ||
      dbLatencyMs > 5000;

    const payload = {
      success: !degraded,
      status: degraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      services: { database: 'connected', api: 'running' },
      db_latency_ms: dbLatencyMs,
      pool: poolStats,
      memory: memInfo,
    };
    try { payload.version = require('../../package.json').version; } catch { /* noop */ }
    res.status(degraded ? 503 : 200).json(payload);
  } catch (error) {
    console.error('[HEALTH/detailed] DB error:', error.message);
    res.status(503).json({ success: false, status: 'down' });
  }
});

module.exports = router;
