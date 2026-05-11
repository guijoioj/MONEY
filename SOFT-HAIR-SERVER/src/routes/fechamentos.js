const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { FechamentoService } = require('../services');
const { logAction } = require('../utils/auditLog');

const service = new FechamentoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, tipo } = req.query;
    const result = await service.listar(req.salaoId, { status, tipo });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Fechamentos em aberto: lista atendimentos finalizados ainda não fechados (agrupados por cliente)
router.get('/em-aberto', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { profissionalId, clienteId } = req.query;

    const params = [req.salaoId];
    let where = `a.salao_id = $1 AND a.status = 'finalizado' AND NOT EXISTS (
      SELECT 1 FROM fechamentos f WHERE f.salao_id = a.salao_id
        AND f.cliente_id = a.cliente_id
        AND a.created_at::date BETWEEN f.data_inicio AND f.data_fim
    )`;
    let p = 2;
    if (profissionalId) { where += ` AND a.profissional_id = $${p++}`; params.push(profissionalId); }
    if (clienteId) { where += ` AND a.cliente_id = $${p++}`; params.push(clienteId); }

    const { rows } = await pool.query(`
      SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
      FROM atendimentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE ${where}
      ORDER BY a.created_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.post('/', authMiddleware, [
  body('data_inicio').isDate().withMessage('data_inicio obrigatória (YYYY-MM-DD)'),
  body('data_fim').isDate().withMessage('data_fim obrigatória (YYYY-MM-DD)'),
  body('tipo').optional().isIn(['diario', 'semanal', 'mensal']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.gerar(req.salaoId, req.body.data_inicio, req.body.data_fim, req.body.tipo);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P5-C5] requireAdmin + motivo obrigatório (B10) + audit log com before/after
router.put('/:id/reabrir', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const motivo = (req.body?.motivo || '').toString().trim();
    if (!motivo || motivo.length < 3) {
      return res.status(400).json({ success: false, error: 'motivo de reabertura obrigatório (mín 3 chars)' });
    }

    // Snapshot before
    const beforeRows = await pool.query(
      'SELECT * FROM fechamentos WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    const before = beforeRows.rows[0] || null;

    const result = await service.reabrir(req.params.id, req.salaoId);
    if (result.success) {
      // Persist motivo + auditor
      try {
        await pool.query(
          `UPDATE fechamentos SET motivo_reabertura = $1, reaberto_por = $2, reaberto_em = NOW()
           WHERE id = $3 AND salao_id = $4`,
          [motivo, req.user?.userId || req.user?.id || null, req.params.id, req.salaoId]
        );
      } catch (_) { /* coluna pode não existir em ambiente antigo */ }

      await logAction({
        req,
        action: 'fechamento.reabrir',
        entityType: 'fechamento',
        entityId: Number(req.params.id),
        before,
        after: { ...result.data, motivo_reabertura: motivo },
      });
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P5-C5] requireAdmin + soft-delete + motivo obrigatório + audit log
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const motivo = (req.body?.motivo || req.query?.motivo || '').toString().trim();
    if (!motivo || motivo.length < 3) {
      return res.status(400).json({ success: false, error: 'motivo de exclusão obrigatório (mín 3 chars)' });
    }

    const beforeRows = await pool.query(
      'SELECT * FROM fechamentos WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    if (beforeRows.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fechamento não encontrado' });
    }
    const before = beforeRows.rows[0];

    // Soft delete (preserve histórico)
    let softOk = false;
    try {
      const upd = await pool.query(
        `UPDATE fechamentos
            SET deleted_at = NOW(), deleted_by = $1, motivo_delete = $2
          WHERE id = $3 AND salao_id = $4 AND deleted_at IS NULL
          RETURNING id`,
        [req.user?.userId || req.user?.id || null, motivo, req.params.id, req.salaoId]
      );
      softOk = upd.rowCount > 0;
    } catch (_) { /* coluna pode não existir em ambiente antigo */ }

    if (!softOk) {
      // Fallback (não deveria ocorrer após migrations). NÃO faz hard-delete sem audit.
      await pool.query('DELETE FROM fechamentos WHERE id = $1 AND salao_id = $2', [req.params.id, req.salaoId]);
    }

    await logAction({
      req,
      action: softOk ? 'fechamento.soft_delete' : 'fechamento.hard_delete',
      entityType: 'fechamento',
      entityId: Number(req.params.id),
      before,
      after: { motivo_delete: motivo },
    });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
