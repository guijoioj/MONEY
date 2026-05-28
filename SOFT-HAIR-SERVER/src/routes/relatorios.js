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

// ─── Relatórios comerciais (dashboard admin) ──────────────────────────────

// GET /faturamento?periodo=mes|semana|hoje — totalizadores agregados.
router.get('/faturamento', authMiddleware, async (req, res) => {
  try {
    const p = (req.query.periodo || 'mes').toLowerCase();
    const intervalSql = p === 'hoje' ? "INTERVAL '1 day'"
                      : p === 'semana' ? "INTERVAL '7 days'"
                      : "INTERVAL '30 days'";
    const r = await query(
      `SELECT
          COALESCE(SUM(v.valor_final), 0)::numeric AS total_faturado,
          COUNT(*)::int                            AS qtd_vendas,
          COALESCE(AVG(v.valor_final), 0)::numeric AS ticket_medio,
          COUNT(DISTINCT v.cliente_id)::int        AS clientes_unicos
         FROM vendas v
        WHERE v.salao_id = $1
          AND COALESCE(v.status,'pendente') NOT IN ('cancelada')
          AND v.created_at >= NOW() - ${intervalSql}`,
      [req.salaoId]
    );
    res.json({ success: true, data: r[0] || r.rows?.[0] });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro", e); }
});

// GET /faturamento-diario?dias=30 — série temporal pra gráfico.
router.get('/faturamento-diario', authMiddleware, async (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
    const r = await query(
      `SELECT DATE(v.created_at) AS dia,
              COALESCE(SUM(v.valor_final), 0)::numeric AS total,
              COUNT(*)::int                            AS qtd
         FROM vendas v
        WHERE v.salao_id = $1
          AND COALESCE(v.status,'pendente') NOT IN ('cancelada')
          AND v.created_at >= NOW() - ($2 || ' days')::interval
        GROUP BY DATE(v.created_at)
        ORDER BY dia ASC`,
      [req.salaoId, String(dias)]
    );
    res.json({ success: true, data: r.rows || r });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro", e); }
});

// GET /ranking-profissionais?dias=30 — top profissionais por faturamento.
router.get('/ranking-profissionais', authMiddleware, async (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
    const r = await query(
      `SELECT p.id, p.nome,
              COUNT(DISTINCT a.id)::int                    AS qtd_atendimentos,
              COALESCE(SUM(a.valor), 0)::numeric            AS total_atendimentos,
              COALESCE(SUM(v.valor_final), 0)::numeric      AS total_vendas
         FROM profissionais p
         LEFT JOIN atendimentos a ON a.profissional_id = p.id AND a.salao_id = p.salao_id
              AND a.created_at >= NOW() - ($2 || ' days')::interval
         LEFT JOIN vendas v ON v.profissional_id = p.id AND v.salao_id = p.salao_id
              AND COALESCE(v.status,'pendente') NOT IN ('cancelada')
              AND v.created_at >= NOW() - ($2 || ' days')::interval
        WHERE p.salao_id = $1 AND COALESCE(p.ativo, true) = true
        GROUP BY p.id, p.nome
        ORDER BY (COALESCE(SUM(a.valor),0) + COALESCE(SUM(v.valor_final),0)) DESC
        LIMIT 20`,
      [req.salaoId, String(dias)]
    );
    res.json({ success: true, data: r.rows || r });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro", e); }
});

// GET /top-clientes?dias=90 — clientes que mais gastaram (por vendas).
router.get('/top-clientes', authMiddleware, async (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 90, 1), 730);
    const r = await query(
      `SELECT c.id, c.nome, c.telefone,
              COUNT(DISTINCT v.id)::int                AS qtd_vendas,
              COALESCE(SUM(v.valor_final), 0)::numeric AS total_gasto,
              MAX(v.created_at)                        AS ultima_compra
         FROM clientes c
         JOIN vendas v ON v.cliente_id = c.id AND v.salao_id = c.salao_id
              AND COALESCE(v.status,'pendente') NOT IN ('cancelada')
              AND v.created_at >= NOW() - ($2 || ' days')::interval
        WHERE c.salao_id = $1
        GROUP BY c.id, c.nome, c.telefone
        ORDER BY total_gasto DESC
        LIMIT 20`,
      [req.salaoId, String(dias)]
    );
    res.json({ success: true, data: r.rows || r });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro", e); }
});

// GET /produtos-vendidos?dias=30 — ranking produtos por quantidade.
router.get('/produtos-vendidos', authMiddleware, async (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
    const r = await query(
      `SELECT p.id, p.nome, p.categoria,
              COALESCE(SUM(vi.quantidade), 0)::int     AS qtd,
              COALESCE(SUM(vi.valor_total), 0)::numeric AS faturado
         FROM venda_itens vi
         JOIN vendas v ON v.id = vi.venda_id
              AND COALESCE(v.status,'pendente') NOT IN ('cancelada')
              AND v.created_at >= NOW() - ($2 || ' days')::interval
         JOIN produtos p ON p.id = vi.produto_id
        WHERE v.salao_id = $1
        GROUP BY p.id, p.nome, p.categoria
        ORDER BY qtd DESC
        LIMIT 20`,
      [req.salaoId, String(dias)]
    );
    res.json({ success: true, data: r.rows || r });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro", e); }
});

// GET /comissoes-pagar — total pendente por profissional.
router.get('/comissoes-pagar', authMiddleware, async (req, res) => {
  try {
    const r = await query(
      `SELECT p.id, p.nome,
              COUNT(*)::int                            AS qtd,
              COALESCE(SUM(c.valor_comissao), 0)::numeric AS total_pendente
         FROM comissoes c
         JOIN profissionais p ON p.id = c.profissional_id
        WHERE c.salao_id = $1
          AND COALESCE(c.status, 'pendente') = 'pendente'
        GROUP BY p.id, p.nome
        ORDER BY total_pendente DESC`,
      [req.salaoId]
    );
    res.json({ success: true, data: r.rows || r });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro", e); }
});

module.exports = router;
