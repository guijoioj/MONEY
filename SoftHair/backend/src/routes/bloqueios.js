/**
 * P6-C1: bloqueios de agenda (slots indisponíveis para agendamento).
 *
 * Tabela criada via migration runtime (initDb.js).
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { query, queryOne, queryRun, rawClient, dbType } = require('../config/database');

// P6-C1: garantir tabela criada (idempotente)
function ensureTable() {
  if (dbType !== 'sqlite') return; // postgres gerencia schema externamente
  try {
    rawClient.exec(`
      CREATE TABLE IF NOT EXISTS bloqueios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
        profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        hora_inicio TEXT,
        hora_fim TEXT,
        motivo TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bloqueios_salao_data ON bloqueios(salao_id, data);
    `);
  } catch (e) {
    console.warn('[bloqueios] ensureTable falhou:', e.message);
  }
}
ensureTable();

router.param('id', validateId);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, profissionalId } = req.query;
    const params = [req.salaoId];
    let sql = `SELECT * FROM bloqueios WHERE salao_id = ?`;
    if (data) { sql += ` AND data = ?`; params.push(data); }
    if (profissionalId) { sql += ` AND profissional_id = ?`; params.push(profissionalId); }
    sql += ` ORDER BY data, hora_inicio`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', authMiddleware, [
  body('data').notEmpty().withMessage('Data é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { profissionalId, data, horaInicio, horaFim, motivo } = req.body;
    const r = await queryRun(
      `INSERT INTO bloqueios (salao_id, profissional_id, data, hora_inicio, hora_fim, motivo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.salaoId,
        profissionalId || null,
        data,
        horaInicio || null,
        horaFim || null,
        motivo || null,
      ]
    );
    const row = await queryOne(`SELECT * FROM bloqueios WHERE id = ?`, [r.lastInsertRowid]);
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const r = await queryRun(
      `DELETE FROM bloqueios WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (r.rowCount === 0) return res.status(404).json({ success: false, error: 'Bloqueio não encontrado' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
