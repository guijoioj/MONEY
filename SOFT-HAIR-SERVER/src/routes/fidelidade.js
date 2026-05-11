const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/fidelidade/saldo/:clienteId
router.get('/saldo/:clienteId', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT COALESCE(SUM(pontos),0) as saldo FROM pontos_fidelidade WHERE salao_id=$1 AND cliente_id=$2`,
      [req.salaoId, req.params.clienteId]
    );
    res.json({ success: true, data: { saldo: parseInt(rows[0]?.saldo || 0) } });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/fidelidade/historico/:clienteId
router.get('/historico/:clienteId', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM pontos_fidelidade WHERE salao_id=$1 AND cliente_id=$2 ORDER BY created_at DESC LIMIT 50`,
      [req.salaoId, req.params.clienteId]
    );
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// POST /api/fidelidade/adicionar
router.post('/adicionar', authMiddleware, async (req, res) => {
  const { clienteId, pontos, descricao, referenciaId, referenciaTipo } = req.body;
  try {
    const row = await query(
      `INSERT INTO pontos_fidelidade (salao_id,cliente_id,pontos,tipo,descricao,referencia_id,referencia_tipo)
       VALUES ($1,$2,$3,'ganho',$4,$5,$6) RETURNING *`,
      [req.salaoId, clienteId, pontos, descricao || 'Pontos adicionados', referenciaId || null, referenciaTipo || null]
    );
    res.json({ success: true, data: row[0] });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// POST /api/fidelidade/resgatar
router.post('/resgatar', authMiddleware, async (req, res) => {
  const { clienteId, pontos, descricao } = req.body;
  try {
    const saldoRows = await query(
      `SELECT COALESCE(SUM(pontos),0) as saldo FROM pontos_fidelidade WHERE salao_id=$1 AND cliente_id=$2`,
      [req.salaoId, clienteId]
    );
    const saldo = parseInt(saldoRows[0]?.saldo || 0);
    if (saldo < pontos) return res.status(400).json({ success: false, error: 'Saldo insuficiente' });
    const row = await query(
      `INSERT INTO pontos_fidelidade (salao_id,cliente_id,pontos,tipo,descricao)
       VALUES ($1,$2,$3,'resgate',$4) RETURNING *`,
      [req.salaoId, clienteId, -pontos, descricao || 'Resgate de pontos']
    );
    res.json({ success: true, data: row[0], saldoAnterior: saldo, saldoNovo: saldo - pontos });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// GET /api/fidelidade/ranking
router.get('/ranking', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.nome, c.telefone, COALESCE(SUM(pf.pontos),0) as saldo
      FROM clientes c
      LEFT JOIN pontos_fidelidade pf ON pf.cliente_id=c.id AND pf.salao_id=$1
      WHERE c.salao_id=$1 AND c.ativo=true
      GROUP BY c.id,c.nome,c.telefone
      HAVING COALESCE(SUM(pf.pontos),0) > 0
      ORDER BY saldo DESC LIMIT 20
    `, [req.salaoId]);
    res.json({ success: true, data: rows });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

module.exports = router;
