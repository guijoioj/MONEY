const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

router.get('/', async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  try {
    // [P5-M5] Check DB connection + latência + pool stats + memória
    const t0 = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - t0;

    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };

    // Memória do processo (free indica memória disponível em MB)
    const mem = process.memoryUsage();
    const memInfo = {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    };

    // Degraded se pool sem idle E há waiting, OU latência muito alta.
    const degraded =
      (poolStats.idle === 0 && poolStats.waiting > 0) ||
      dbLatencyMs > 5000;

    const payload = {
      success: !degraded,
      status: degraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'running',
      },
      db_latency_ms: dbLatencyMs,
      pool: poolStats,
      memory: memInfo,
    };
    if (!isProd) {
      try { payload.version = require('../../package.json').version; } catch { /* noop */ }
    }
    res.status(degraded ? 503 : 200).json(payload);
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
