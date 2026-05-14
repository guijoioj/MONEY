const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { query, queryOne, queryRun } = require('../config/database');
const { validateFKs } = require('../lib/tenant');

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

// P6-C1: marcar atendimento(s) como finalizado(s) com pagamento
router.post('/fechamento', authMiddleware, async (req, res) => {
  try {
    const { atendimento_ids, forma_pagamento, observacoes } = req.body || {};
    if (!Array.isArray(atendimento_ids) || atendimento_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'atendimento_ids deve ser array não-vazio' });
    }
    let count = 0;
    for (const id of atendimento_ids) {
      const r = await queryRun(
        `UPDATE atendimentos
         SET status = 'finalizado',
             observacoes = COALESCE(?, observacoes),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND salao_id = ? AND status != 'finalizado'`,
        [observacoes || null, id, req.salaoId]
      );
      if (r.rowCount > 0) count++;
    }
    res.json({ success: true, data: { finalizados: count, forma_pagamento: forma_pagamento || null } });
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

    // P3-C4: tenant validation para FKs
    const badFK = await validateFKs(
      [
        { table: 'clientes', id: cliente_id },
        { table: 'profissionais', id: profissional_id },
        { table: 'servicos', id: servico_id },
        { table: 'agendamentos', id: agendamento_id },
      ],
      req.salaoId
    );
    if (badFK) {
      return res.status(400).json({
        success: false,
        error: `Referência inválida: ${badFK.table}#${badFK.id} não pertence a este salão`,
      });
    }

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

    // P3-C4: validar agendamento_id se alterado
    if (req.body.agendamento_id !== undefined && req.body.agendamento_id !== null) {
      const badFK = await validateFKs(
        [{ table: 'agendamentos', id: req.body.agendamento_id }],
        req.salaoId
      );
      if (badFK) {
        return res.status(400).json({
          success: false,
          error: `Referência inválida: ${badFK.table}#${badFK.id} não pertence a este salão`,
        });
      }
    }

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

    updates.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
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

// P3-A10: soft delete em vez de DELETE — preserva audit trail e suporta LGPD/recovery.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await queryRun(
      `UPDATE atendimentos SET status = 'cancelado', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND salao_id = ? AND status != 'cancelado'`,
      [req.params.id, req.salaoId]
    );
    if (result.rowCount === 0) {
      // Pode ser que não exista OU já estava cancelado — diferenciamos
      const exists = await queryOne(
        `SELECT id FROM atendimentos WHERE id = ? AND salao_id = ?`,
        [req.params.id, req.salaoId]
      );
      if (!exists) return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });
      return res.json({ success: true, message: 'Atendimento já estava cancelado' });
    }
    res.json({ success: true, message: 'Atendimento cancelado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
