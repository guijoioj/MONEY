const express = require('express');
const router = express.Router();
const { rawClient, dbType } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    if (dbType === 'sqlite') {
      rawClient.prepare('SELECT 1').get();
    } else {
      await rawClient.query('SELECT 1');
    }
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbType,
    });
  } catch (error) {
    res.status(503).json({ success: false, status: 'unhealthy', error: error.message });
  }
});

module.exports = router;
