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
    const { status, data_inicio, data_fim, cliente_id, profissional_id } = req.query;
    const params = [req.salaoId];
    let sql = `
      SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
      FROM agendamentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE a.salao_id = ?
    `;
    if (status) { sql += ` AND a.status = ?`; params.push(status); }
    if (data_inicio && data_fim) {
      sql += ` AND date(a.data_hora) BETWEEN ? AND ?`;
      params.push(data_inicio, data_fim);
    }
    if (cliente_id) { sql += ` AND a.cliente_id = ?`; params.push(cliente_id); }
    if (profissional_id) { sql += ` AND a.profissional_id = ?`; params.push(profissional_id); }
    sql += ` ORDER BY a.data_hora`;

    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/disponiveis/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) return res.status(400).json({ success: false, error: 'Parâmetro "data" é obrigatório' });
    const result = await query(
      `SELECT a.data_hora, a.duracao_minutos, s.duracao_minutos as servico_duracao
       FROM agendamentos a
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.profissional_id = ? AND a.salao_id = ? AND date(a.data_hora) = ? AND a.status != 'cancelado'
       ORDER BY a.data_hora`,
      [req.params.profissionalId, req.salaoId, data]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await queryOne(
      `SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
              p.nome as profissional_nome, s.nome as servico_nome
       FROM agendamentos a
       LEFT JOIN clientes c ON c.id = a.cliente_id
       LEFT JOIN profissionais p ON p.id = a.profissional_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.id = ? AND a.salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!data) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id é obrigatório'),
  body('servico_id').isInt().withMessage('servico_id é obrigatório'),
  body('data_hora').notEmpty().withMessage('data_hora é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { cliente_id, profissional_id, servico_id, data_hora, duracao_minutos, observacoes, valor, status } = req.body;
    const result = await queryRun(
      `INSERT INTO agendamentos (salao_id, cliente_id, profissional_id, servico_id, data_hora, duracao_minutos, observacoes, valor, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.salaoId, cliente_id, profissional_id || null, servico_id,
        data_hora, duracao_minutos || null, observacoes || null,
        valor || 0, status || 'agendado',
      ]
    );
    const data = await queryOne(`SELECT * FROM agendamentos WHERE id = ?`, [result.lastInsertRowid]);
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await queryOne(
      `SELECT * FROM agendamentos WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!existing) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

    const fields = ['cliente_id', 'profissional_id', 'servico_id', 'data_hora', 'duracao_minutos', 'observacoes', 'valor', 'status'];
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
      `UPDATE agendamentos SET ${updates.join(', ')} WHERE id = ? AND salao_id = ?`,
      params
    );
    const data = await queryOne(`SELECT * FROM agendamentos WHERE id = ?`, [req.params.id]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const motivo = req.body.motivo || 'Cancelado pelo usuário';
    const result = await queryRun(
      `UPDATE agendamentos SET status = 'cancelado', observacoes = COALESCE(observacoes, '') || ' [Cancelado: ' || ? || ']', updated_at = datetime('now') WHERE id = ? AND salao_id = ?`,
      [motivo, req.params.id, req.salaoId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    res.json({ success: true, message: 'Agendamento cancelado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
