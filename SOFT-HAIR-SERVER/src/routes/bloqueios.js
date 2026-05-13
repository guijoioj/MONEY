const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// GET /?data=YYYY-MM-DD
// [P4-C2] Sempre filtrar por salao_id do JWT — nunca vazar bloqueios de outros salões.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, profissionalId } = req.query;
    let sql = `SELECT b.*, p.nome as profissional_nome
               FROM bloqueios_horario b
               LEFT JOIN profissionais p ON p.id = b.profissional_id
               WHERE b.salao_id = $1`;
    const params = [req.salaoId];

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
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Erro ao buscar bloqueios:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar bloqueios' });
  }
});

// POST /
// [P4-C2] salao_id vem SEMPRE do JWT (req.salaoId), nunca do body.
// profissional_id é validado contra o mesmo salão antes do INSERT (cross-tenant guard).
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { profissionalId, dataInicio, dataFim, motivo, diaInteiro } = req.body;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ success: false, error: 'dataInicio e dataFim são obrigatórios' });
    }

    // [P4-C2] Validar tenancy de profissional_id quando informado.
    if (profissionalId) {
      const ownsProf = await query(
        'SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2',
        [profissionalId, req.salaoId]
      );
      if (!ownsProf.length) {
        return res.status(403).json({ success: false, error: 'Profissional não pertence ao salão' });
      }
    }

    const result = await query(
      `INSERT INTO bloqueios_horario (salao_id, profissional_id, data_inicio, data_fim, motivo, dia_inteiro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.salaoId, profissionalId || null, dataInicio, dataFim, motivo || 'Bloqueado', diaInteiro || false]
    );

    res.status(201).json({ success: true, data: result[0] });
  } catch (err) {
    console.error('Erro ao criar bloqueio:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar bloqueio' });
  }
});

// DELETE /:id
// [P4-C2] DELETE com `AND salao_id = $X` — impede admin de salão A deletar bloqueios de B.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM bloqueios_horario WHERE id = $1 AND salao_id = $2 RETURNING id',
      [id, req.salaoId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Bloqueio não encontrado' });
    }

    res.json({ success: true, message: 'Bloqueio removido' });
  } catch (err) {
    console.error('Erro ao deletar bloqueio:', err);
    res.status(500).json({ success: false, error: 'Erro ao deletar bloqueio' });
  }
});

module.exports = router;
