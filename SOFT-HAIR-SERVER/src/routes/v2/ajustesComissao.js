/**
 * /api/v2/comissoes/ajustes — bonus/desconto/adiantamento/correcao manual.
 *
 * Estornos automáticos (de venda cancelada) usam o mesmo schema mas via
 * VendaService → não passam por este endpoint.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const { pool } = require('../../config/database');
const { logAction } = require('../../utils/auditLog');
const { sendError } = require('../../utils/sendError');

// Ajustes de comissão (V2): admin-only.
router.use(authMiddleware, requireRole('admin'));

const TIPOS = ['bonus','desconto','adiantamento','correcao','meta_retroativa','estorno'];

// GET — lista com filtros
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { profissional_id, tipo, status, competencia } = req.query;
    let sql = `SELECT a.*, p.nome AS profissional_nome
                 FROM comissoes_ajustes a
                 LEFT JOIN profissionais p ON p.id = a.profissional_id
                WHERE a.salao_id = $1`;
    const params = [req.salaoId];
    let i = 2;
    if (profissional_id) { sql += ` AND a.profissional_id = $${i++}`; params.push(profissional_id); }
    if (tipo)            { sql += ` AND a.tipo = $${i++}`; params.push(tipo); }
    if (status)          { sql += ` AND a.status = $${i++}`; params.push(status); }
    if (competencia)     {
      sql += ` AND a.competencia = $${i++}::date`;
      params.push(competencia.length === 7 ? `${competencia}-01` : competencia);
    }
    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    const { rows } = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) { sendError(res, 500, 'Erro', error); }
});

// POST — cria ajuste (admin)
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { profissional_id, tipo, valor_cents, motivo, competencia } = req.body;
    if (!profissional_id) return res.status(400).json({ success: false, error: 'profissional_id obrigatório' });
    if (!TIPOS.includes(tipo)) return res.status(400).json({ success: false, error: `tipo inválido. Valores: ${TIPOS.join(', ')}` });
    if (!Number.isInteger(Number(valor_cents))) return res.status(400).json({ success: false, error: 'valor_cents deve ser integer (pode ser negativo)' });
    if (!motivo || motivo.trim().length === 0) return res.status(400).json({ success: false, error: 'motivo obrigatório' });

    // Tenancy
    const profOk = await pool.query(
      'SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2',
      [profissional_id, req.salaoId]
    );
    if (!profOk.rows.length) return res.status(403).json({ success: false, error: 'profissional não pertence ao salão' });

    const { rows } = await pool.query(
      `INSERT INTO comissoes_ajustes (
         salao_id, profissional_id, tipo, valor_cents, motivo,
         competencia, status, criado_por
       ) VALUES ($1,$2,$3,$4,$5,$6,'pendente',$7)
       RETURNING *`,
      [req.salaoId, profissional_id, tipo, Number(valor_cents), motivo,
       competencia || null, req.user?.userId || null]
    );

    await logAction({
      req, action: 'ajuste.criar',
      entityType: 'comissoes_ajustes', entityId: rows[0].id, after: rows[0],
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) { sendError(res, 500, 'Erro criando ajuste', error); }
});

// PUT /:id/cancelar
router.put('/:id/cancelar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE comissoes_ajustes
          SET status = 'cancelado', updated_at = NOW()
        WHERE id = $1 AND salao_id = $2 AND status = 'pendente'
      RETURNING *`,
      [req.params.id, req.salaoId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Ajuste pendente não encontrado' });

    await logAction({
      req, action: 'ajuste.cancelar',
      entityType: 'comissoes_ajustes', entityId: Number(req.params.id), after: rows[0],
    });

    res.json({ success: true, data: rows[0] });
  } catch (error) { sendError(res, 500, 'Erro', error); }
});

module.exports = router;
