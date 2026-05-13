const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { query, queryOne, queryRun } = require('../config/database');

// P2-A2 (E28): valida `:id` numérico.
router.param('id', validateId);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, profissional_id, data_inicio, data_fim, limit } = req.query;
    const params = [req.salaoId];
    let sql = `
      SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
      FROM atendimentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE a.salao_id = ?
    `;
    if (status) { sql += ` AND a.status = ?`; params.push(status); }
    if (profissional_id) { sql += ` AND a.profissional_id = ?`; params.push(profissional_id); }
    if (data_inicio && data_fim) {
      sql += ` AND date(a.created_at) BETWEEN ? AND ?`;
      params.push(data_inicio, data_fim);
    }
    sql += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(parseInt(limit) || 200);

    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await queryOne(
      `SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
       FROM atendimentos a
       LEFT JOIN clientes c ON c.id = a.cliente_id
       LEFT JOIN profissionais p ON p.id = a.profissional_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.id = ? AND a.salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!data) return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id é obrigatório'),
  body('profissional_id').isInt().withMessage('profissional_id é obrigatório'),
  body('servico_id').isInt().withMessage('servico_id é obrigatório'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { cliente_id, profissional_id, servico_id, agendamento_id, valor, status, observacoes } = req.body;
    const result = await queryRun(
      `INSERT INTO atendimentos (salao_id, cliente_id, profissional_id, servico_id, agendamento_id, valor, status, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.salaoId, cliente_id, profissional_id, servico_id,
        agendamento_id || null, valor || 0, status || 'em_andamento', observacoes || null,
      ]
    );
    const data = await queryOne(`SELECT * FROM atendimentos WHERE id = ?`, [result.lastInsertRowid]);
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await queryOne(
      `SELECT * FROM atendimentos WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!existing) return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });

    const fields = ['status', 'observacoes', 'valor', 'agendamento_id'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.json({ success: true, data: existing });

    updates.push(`updated_at = datetime('now')`);
    params.push(req.params.id, req.salaoId);

    await queryRun(
      `UPDATE atendimentos SET ${updates.join(', ')} WHERE id = ? AND salao_id = ?`,
      params
    );
    const data = await queryOne(`SELECT * FROM atendimentos WHERE id = ?`, [req.params.id]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await queryRun(
      `DELETE FROM atendimentos WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });
    res.json({ success: true, message: 'Atendimento removido' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
