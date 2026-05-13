const express = require('express');
const router = express.Router();
const { rawClient, dbType } = require('../config/database');

// P3-A1: endpoint público — minimal info para evitar leak via DNS rebinding.
// Antes retornava `database: dbType` e timestamp detalhado. Atacante remoto
// (mesmo bloqueado por Host check) podia medir presença/versão via timing.
router.get('/', async (req, res) => {
  try {
    if (dbType === 'sqlite') {
      rawClient.prepare('SELECT 1').get();
    } else {
      await rawClient.query('SELECT 1');
    }
    res.json({ ok: 1 });
  } catch (error) {
    res.status(503).json({ ok: 0 });
  }
});

module.exports = router;
