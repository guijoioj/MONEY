const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { query, withTransaction } = require('../config/database');

// Fidelidade: admin + recepção (operação de salão — dar/resgatar pontos).
router.use(authMiddleware, requireAnyRole(['admin', 'recepcao']));

// Limites de pontos por operação manual.
const PONTOS_MIN = 1;
const PONTOS_MAX = 100000;

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
// [P4-C3] Apenas admin pode atribuir pontos manualmente. Validar tenancy do cliente e range de pontos.
// Pontos NUNCA aceitos cegamente do payload — sempre verificados server-side.
router.post('/adicionar', authMiddleware, /* admin+recepcao via router.use */ async (req, res) => {
  const { clienteId, pontos, descricao, referenciaId, referenciaTipo } = req.body;
  try {
    // [P4-C3] Validar `pontos` server-side (positivo, range).
    const pontosNum = Number(pontos);
    if (!Number.isInteger(pontosNum) || pontosNum < PONTOS_MIN || pontosNum > PONTOS_MAX) {
      return res.status(400).json({
        success: false,
        error: `Pontos deve ser inteiro entre ${PONTOS_MIN} e ${PONTOS_MAX}`
      });
    }

    // [P4-C3] Validar que clienteId pertence ao salão do JWT (tenancy guard).
    const clienteOk = await query(
      'SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2',
      [clienteId, req.salaoId]
    );
    if (!clienteOk.length) {
      return res.status(403).json({ success: false, error: 'Cliente não pertence ao salão' });
    }

    const row = await query(
      `INSERT INTO pontos_fidelidade (salao_id,cliente_id,pontos,tipo,descricao,referencia_id,referencia_tipo)
       VALUES ($1,$2,$3,'ganho',$4,$5,$6) RETURNING *`,
      [req.salaoId, clienteId, pontosNum, descricao || 'Pontos adicionados', referenciaId || null, referenciaTipo || null]
    );
    res.json({ success: true, data: row[0] });
  } catch (e) { require("../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

// POST /api/fidelidade/resgatar
// [P4-C4] Transação + SELECT FOR UPDATE em pontos do cliente para evitar double-spend
// em requisições concorrentes (cliente.pontos lidos com lock; INSERT só ocorre se saldo
// real >= solicitado dentro da transação).
router.post('/resgatar', authMiddleware, /* admin+recepcao via router.use */ async (req, res) => {
  const { clienteId, pontos, descricao } = req.body;
  try {
    // [P4-C4] Validação de range também no resgate.
    const pontosNum = Number(pontos);
    if (!Number.isInteger(pontosNum) || pontosNum < PONTOS_MIN || pontosNum > PONTOS_MAX) {
      return res.status(400).json({
        success: false,
        error: `Pontos deve ser inteiro entre ${PONTOS_MIN} e ${PONTOS_MAX}`
      });
    }

    const result = await withTransaction(async (client) => {
      // [P4-C4] FOR UPDATE em todas as linhas (cliente, salao) — serializa concorrência.
      // Bloqueia explicitamente o conjunto de pontos_fidelidade desse (salao_id, cliente_id)
      // até COMMIT/ROLLBACK; concorrente terá que esperar e recomputar o saldo.
      const lockRes = await client.query(
        `SELECT COALESCE(SUM(pontos),0) AS saldo
           FROM pontos_fidelidade
          WHERE salao_id = $1 AND cliente_id = $2
          FOR UPDATE`,
        [req.salaoId, clienteId]
      );
      const saldo = parseInt(lockRes.rows[0]?.saldo || 0);
      if (saldo < pontosNum) {
        return { ok: false, status: 400, error: 'Saldo insuficiente', saldo };
      }

      const ins = await client.query(
        `INSERT INTO pontos_fidelidade (salao_id,cliente_id,pontos,tipo,descricao)
         VALUES ($1,$2,$3,'resgate',$4) RETURNING *`,
        [req.salaoId, clienteId, -pontosNum, descricao || 'Resgate de pontos']
      );
      return { ok: true, row: ins.rows[0], saldo };
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      data: result.row,
      saldoAnterior: result.saldo,
      saldoNovo: result.saldo - pontosNum
    });
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
