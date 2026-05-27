const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { query } = require('../config/database');

// Caixa do salão: admin-only.
router.use(authMiddleware, requireRole('admin'));

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
    // [P2-M3] saldo_inicial não pode ser negativo (evita lavagem contábil)
    const saldoInicialRaw = req.body?.saldo_inicial;
    const saldo_inicial = saldoInicialRaw === undefined || saldoInicialRaw === null ? 0 : Number(saldoInicialRaw);
    if (!Number.isFinite(saldo_inicial) || saldo_inicial < 0) {
      return res.status(400).json({ success: false, error: 'saldo_inicial deve ser número >= 0' });
    }
    const observacoes = req.body?.observacoes;

    // [P2-B7] authMiddleware seta req.user (com userId dentro), não req.userId — pegar de req.user
    const abertoPor = req.user?.userId || req.user?.id || null;

    // [P2-A3] INSERT atômico — só insere se não houver outro caixa aberto hoje no mesmo salão.
    // [P8-M1] Combinado com UNIQUE partial index `unq_caixa_salao_dia_aberto`:
    //   - INSERT...WHERE NOT EXISTS resolve o caso comum (sem race)
    //   - UNIQUE constraint resolve a janela de race em READ COMMITTED (dois INSERTs
    //     paralelos podem ambos ver NOT EXISTS=true; o segundo levanta 23505)
    try {
      const inserted = await query(
        `INSERT INTO caixa (salao_id, saldo_inicial, observacoes, aberto_por)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM caixa
           WHERE salao_id = $1 AND DATE(aberto_em) = CURRENT_DATE AND fechado_em IS NULL
         )
         RETURNING *`,
        [req.salaoId, saldo_inicial, observacoes || null, abertoPor]
      );
      if (!inserted.length) {
        return res.status(409).json({ success: false, error: 'Caixa já está aberto hoje.' });
      }
      return res.json({ success: true, data: inserted[0] });
    } catch (err) {
      // [P8-M1] unique_violation = race detectado pelo DB
      if (err && err.code === '23505') {
        return res.status(409).json({ success: false, error: 'Caixa já está aberto hoje.' });
      }
      throw err;
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// PUT /api/caixa/:id/fechar
router.put('/:id/fechar', authMiddleware, async (req, res) => {
  try {
    const { saldo_final, observacoes } = req.body;

    // [P5-M8] Validar saldo_final: número finito, >= 0, limite superior sanidade
    const saldoFinalNum = Number(saldo_final);
    if (!Number.isFinite(saldoFinalNum) || saldoFinalNum < 0 || saldoFinalNum > 10_000_000) {
      return res.status(400).json({
        success: false,
        error: 'saldo_final deve ser número >= 0 e <= 10000000'
      });
    }

    const updated = await query(
      `UPDATE caixa SET saldo_final = $1, fechado_em = NOW(), observacoes = COALESCE($2, observacoes)
       WHERE id = $3 AND salao_id = $4 AND fechado_em IS NULL RETURNING *`,
      [saldoFinalNum, observacoes || null, req.params.id, req.salaoId]
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
