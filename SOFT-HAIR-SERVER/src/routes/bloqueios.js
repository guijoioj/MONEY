const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /?data=YYYY-MM-DD
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, profissionalId } = req.query;
    let sql = `SELECT b.*, p.nome as profissional_nome
               FROM bloqueios_horario b
               LEFT JOIN profissionais p ON p.id = b.profissional_id
               WHERE 1=1`;
    const params = [];

    if (data) {
      params.push(data);
      sql += ` AND DATE(b.data_inicio AT TIME ZONE 'UTC') = $${params.length}`;
    }

    if (profissionalId) {
      params.push(profissionalId);
      sql += ` AND (b.profissional_id = $${params.length} OR b.profissional_id IS NULL)`;
    }

    sql += ' ORDER BY b.data_inicio ASC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erro ao buscar bloqueios:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar bloqueios' });
  }
});

// POST /
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { profissionalId, dataInicio, dataFim, motivo, diaInteiro, salaoId } = req.body;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ success: false, error: 'dataInicio e dataFim são obrigatórios' });
    }

    const result = await query(
      `INSERT INTO bloqueios_horario (salao_id, profissional_id, data_inicio, data_fim, motivo, dia_inteiro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [salaoId || null, profissionalId || null, dataInicio, dataFim, motivo || 'Bloqueado', diaInteiro || false]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erro ao criar bloqueio:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar bloqueio' });
  }
});

// DELETE /:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM bloqueios_horario WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bloqueio não encontrado' });
    }

    res.json({ success: true, message: 'Bloqueio removido' });
  } catch (err) {
    console.error('Erro ao deletar bloqueio:', err);
    res.status(500).json({ success: false, error: 'Erro ao deletar bloqueio' });
  }
});

module.exports = router;
