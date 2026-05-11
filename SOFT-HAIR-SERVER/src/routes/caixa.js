const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/caixa/hoje
router.get('/hoje', authMiddleware, async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const caixaRows = await query(
      `SELECT * FROM caixa WHERE salao_id = $1 AND DATE(aberto_em) = $2 ORDER BY aberto_em DESC LIMIT 1`,
      [req.salaoId, hoje]
    );
    const caixa = caixaRows[0] || null;

    let totalVendas = 0;
    if (caixa) {
      const vendasRows = await query(
        `SELECT COALESCE(SUM(valor_final), 0) as total FROM vendas WHERE salao_id = $1 AND DATE(created_at) = $2 AND status != 'cancelada'`,
        [req.salaoId, hoje]
      );
      totalVendas = parseFloat(vendasRows[0]?.total || 0);
    }

    res.json({
      success: true,
      data: {
        caixa,
        total_vendas: totalVendas,
        total_despesas: 0,
        saldo_estimado: caixa ? (parseFloat(caixa.saldo_inicial) + totalVendas) : null
      }
    });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// GET /api/caixa — histórico 30 dias
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM caixa WHERE salao_id = $1 AND aberto_em >= NOW() - INTERVAL '30 days' ORDER BY aberto_em DESC`,
      [req.salaoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// POST /api/caixa/abrir
router.post('/abrir', authMiddleware, async (req, res) => {
  try {
    const { saldo_inicial = 0, observacoes } = req.body;
    const hoje = new Date().toISOString().split('T')[0];

    const existing = await query(
      `SELECT id FROM caixa WHERE salao_id = $1 AND DATE(aberto_em) = $2 AND fechado_em IS NULL`,
      [req.salaoId, hoje]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Caixa já está aberto hoje.' });
    }

    const inserted = await query(
      `INSERT INTO caixa (salao_id, saldo_inicial, observacoes, aberto_por) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.salaoId, saldo_inicial, observacoes || null, req.userId]
    );
    res.json({ success: true, data: inserted[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// PUT /api/caixa/:id/fechar
router.put('/:id/fechar', authMiddleware, async (req, res) => {
  try {
    const { saldo_final, observacoes } = req.body;
    const updated = await query(
      `UPDATE caixa SET saldo_final = $1, fechado_em = NOW(), observacoes = COALESCE($2, observacoes)
       WHERE id = $3 AND salao_id = $4 AND fechado_em IS NULL RETURNING *`,
      [saldo_final, observacoes || null, req.params.id, req.salaoId]
    );
    if (updated.length === 0) {
      return res.status(404).json({ success: false, error: 'Caixa não encontrado ou já fechado.' });
    }
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
