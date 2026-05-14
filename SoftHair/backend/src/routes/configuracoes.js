/**
 * P6-C1: configurações key-value do salão.
 *
 * Tabela criada via migration runtime (initDb.js style — feita aqui em ensureTable).
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { query, queryRun, rawClient, dbType } = require('../config/database');

function ensureTable() {
  if (dbType !== 'sqlite') return;
  try {
    rawClient.exec(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        salao_id INTEGER NOT NULL,
        chave TEXT NOT NULL,
        valor TEXT,
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (salao_id, chave)
      );
    `);
  } catch (e) {
    console.warn('[configuracoes] ensureTable falhou:', e.message);
  }
}
ensureTable();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT chave, valor FROM configuracoes WHERE salao_id = ?`,
      [req.salaoId]
    );
    const out = {};
    for (const r of rows || []) out[r.chave] = r.valor;
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/', authMiddleware, [
  body('chave').isString().notEmpty().withMessage('chave obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { chave, valor } = req.body;
    if (!/^[A-Za-z0-9_.-]+$/.test(chave) || chave.length > 64) {
      return res.status(400).json({ success: false, error: 'chave inválida (somente alfanum, _, -, ., max 64)' });
    }
    const valorStr = valor === null || valor === undefined ? null : String(valor);
    if (valorStr && valorStr.length > 4000) {
      return res.status(400).json({ success: false, error: 'valor excede 4000 chars' });
    }
    await queryRun(
      `INSERT INTO configuracoes (salao_id, chave, valor) VALUES (?, ?, ?)
       ON CONFLICT(salao_id, chave) DO UPDATE
       SET valor = excluded.valor,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [req.salaoId, chave, valorStr]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
