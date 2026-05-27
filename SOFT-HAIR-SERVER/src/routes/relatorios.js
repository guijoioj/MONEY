const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { query } = require('../config/database');

// Relatórios gerenciais: admin-only.
router.use(authMiddleware, requireRole('admin'));

// GET /api/relatorios/servicos-mais-vendidos?dias=30
router.get('/servicos-mais-vendidos', authMiddleware, async (req, res) => {
  const dias = parseInt(req.query.dias) || 30;
  try {
    const rows = await query(`
      SELECT s.nome, COUNT(*) as total, SUM(ai.valor_unitario) as receita
      FROM atendimento_itens ai
      JOIN servicos s ON s.id = ai.servico_id
      JOIN atendimentos a ON a.id = ai.atendimento_id
      WHERE a.salao_id = $1 AND a.created_at >= NOW() - INTERVAL '${dias} days'
      GROUP BY s.id, s.nome ORDER BY total DESC LIMIT 10
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/relatorios/horarios-pico?semanas=4
router.get('/horarios-pico', authMiddleware, async (req, res) => {
  const semanas = parseInt(req.query.semanas) || 4;
  try {
    const rows = await query(`
      SELECT
        EXTRACT(DOW FROM data_hora) as dia_semana,
        EXTRACT(HOUR FROM data_hora) as hora,
        COUNT(*) as total
      FROM agendamentos
      WHERE salao_id = $1 AND data_hora >= NOW() - INTERVAL '${semanas} weeks'
        AND status NOT IN ('cancelado')
      GROUP BY dia_semana, hora ORDER BY dia_semana, hora
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/relatorios/cancelamentos?dias=30
router.get('/cancelamentos', authMiddleware, async (req, res) => {
  const dias = parseInt(req.query.dias) || 30;
  try {
    const rows = await query(`
      SELECT
        p.nome as profissional,
        COUNT(*) FILTER (WHERE a.status = 'cancelado') as cancelados,
        COUNT(*) as total,
        ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'cancelado') / NULLIF(COUNT(*),0), 1) as taxa
      FROM agendamentos a
      JOIN profissionais p ON p.id = a.profissional_id
      WHERE a.salao_id = $1 AND a.data_hora >= NOW() - INTERVAL '${dias} days'
      GROUP BY p.id, p.nome ORDER BY cancelados DESC
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/relatorios/clientes-inativos?dias=60
router.get('/clientes-inativos', authMiddleware, async (req, res) => {
  const dias = parseInt(req.query.dias) || 60;
  try {
    const rows = await query(`
      SELECT c.id, c.nome, c.telefone, c.email,
        MAX(a.data_hora) as ultimo_agendamento,
        (NOW() - MAX(a.data_hora))::text as tempo_inativo
      FROM clientes c
      LEFT JOIN agendamentos a ON a.cliente_id = c.id AND a.salao_id = $1
        AND a.status NOT IN ('cancelado')
      WHERE c.salao_id = $1 AND c.ativo = true
      GROUP BY c.id, c.nome, c.telefone, c.email
      HAVING MAX(a.data_hora) < NOW() - INTERVAL '${dias} days'
          OR MAX(a.data_hora) IS NULL
      ORDER BY ultimo_agendamento ASC NULLS FIRST LIMIT 50
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/relatorios/comparativo-mensal?meses=6
router.get('/comparativo-mensal', authMiddleware, async (req, res) => {
  const meses = parseInt(req.query.meses) || 6;
  try {
    const rows = await query(`
      SELECT
        TO_CHAR(data_hora, 'YYYY-MM') as mes,
        COUNT(*) as total_agendamentos,
        COUNT(*) FILTER (WHERE status = 'confirmado' OR status = 'convertido') as confirmados,
        COUNT(*) FILTER (WHERE status = 'cancelado') as cancelados
      FROM agendamentos
      WHERE salao_id = $1 AND data_hora >= NOW() - INTERVAL '${meses} months'
      GROUP BY mes ORDER BY mes
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/relatorios/ticket-medio?dias=30
router.get('/ticket-medio', authMiddleware, async (req, res) => {
  const dias = parseInt(req.query.dias) || 30;
  try {
    const rows = await query(`
      SELECT
        c.nome, c.telefone,
        COUNT(DISTINCT f.id) as visitas,
        COALESCE(SUM(f.total_geral),0) as total_gasto,
        COALESCE(AVG(f.total_geral),0) as ticket_medio
      FROM clientes c
      JOIN fechamentos f ON f.cliente_id = c.id AND f.salao_id = $1
        AND f.data >= NOW() - INTERVAL '${dias} days'
      WHERE c.salao_id = $1
      GROUP BY c.id, c.nome, c.telefone
      ORDER BY total_gasto DESC LIMIT 20
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

module.exports = router;
