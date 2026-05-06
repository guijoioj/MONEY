const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

// POST /api/metas — upsert meta
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { profissional_id, mes, ano, meta_valor = 0, meta_atendimentos = 0 } = req.body;
    const result = await query(
      `INSERT INTO metas_profissional (salao_id, profissional_id, mes, ano, meta_valor, meta_atendimentos)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (salao_id, profissional_id, mes, ano)
       DO UPDATE SET meta_valor = $5, meta_atendimentos = $6
       RETURNING *`,
      [req.salaoId, profissional_id, mes, ano, meta_valor, meta_atendimentos]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/metas/progresso?mes=&ano=
router.get('/progresso', authMiddleware, async (req, res) => {
  try {
    const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const ano = parseInt(req.query.ano) || new Date().getFullYear();

    const result = await query(
      `SELECT
         p.id, p.nome, p.foto,
         COALESCE(m.meta_valor, 0) as meta_valor,
         COALESCE(m.meta_atendimentos, 0) as meta_atendimentos,
         m.id as meta_id,
         COALESCE((
           SELECT SUM(v.total) FROM vendas v
           WHERE v.profissional_id = p.id
             AND v.salao_id = $1
             AND EXTRACT(MONTH FROM v.created_at) = $2
             AND EXTRACT(YEAR FROM v.created_at) = $3
             AND v.status != 'cancelada'
         ), 0) as realizado_valor,
         COALESCE((
           SELECT COUNT(*) FROM agendamentos a
           WHERE a.profissional_id = p.id
             AND a.salao_id = $1
             AND EXTRACT(MONTH FROM a.data_hora) = $2
             AND EXTRACT(YEAR FROM a.data_hora) = $3
             AND a.status = 'concluido'
         ), 0) as realizado_atendimentos
       FROM profissionais p
       LEFT JOIN metas_profissional m
         ON m.profissional_id = p.id AND m.salao_id = $1 AND m.mes = $2 AND m.ano = $3
       WHERE p.salao_id = $1 AND p.ativo = true
       ORDER BY p.nome`,
      [req.salaoId, mes, ano]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
