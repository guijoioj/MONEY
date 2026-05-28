/**
 * GET /api/audit-log — admin-only.
 * Lista entradas da tabela audit_log com filtros + paginação.
 *
 * Query params:
 *   action        - filtro por ação canônica (ex: 'venda.cancelar')
 *   entity_type   - 'venda' | 'produto' | 'fechamento' | etc.
 *   entity_id     - ID da entidade
 *   actor_id      - usuário que executou
 *   actor_type    - 'admin' | 'recepcao' | 'profissional'
 *   data_inicio   - YYYY-MM-DD
 *   data_fim      - YYYY-MM-DD
 *   page          - 1..N (default 1)
 *   per_page      - 1..200 (default 50)
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { pool } = require('../config/database');

router.use(authMiddleware, requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    const {
      action, entity_type, entity_id, actor_id, actor_type,
      data_inicio, data_fim,
    } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.per_page) || 50));
    const offset = (page - 1) * perPage;

    const where = ['al.salao_id = $1'];
    const params = [req.salaoId];
    let p = 2;

    if (action)      { where.push(`al.action ILIKE $${p++}`);      params.push(`%${action}%`); }
    if (entity_type) { where.push(`al.entity_type = $${p++}`);     params.push(entity_type); }
    if (entity_id)   { where.push(`al.entity_id = $${p++}`);       params.push(Number(entity_id)); }
    if (actor_id)    { where.push(`al.actor_id = $${p++}`);        params.push(Number(actor_id)); }
    if (actor_type)  { where.push(`al.actor_type = $${p++}`);      params.push(actor_type); }
    if (data_inicio) { where.push(`al.created_at >= $${p++}`);     params.push(data_inicio); }
    if (data_fim)    { where.push(`al.created_at < ($${p++}::date + INTERVAL '1 day')`); params.push(data_fim); }

    const whereSql = where.join(' AND ');

    const [list, total] = await Promise.all([
      pool.query(
        `SELECT al.id, al.action, al.actor_id, al.actor_type, al.entity_type, al.entity_id,
                al.before_data, al.after_data, al.ip, al.user_agent, al.created_at,
                u.nome AS actor_nome, u.email AS actor_email
           FROM audit_log al
           LEFT JOIN usuarios u ON u.id = al.actor_id
          WHERE ${whereSql}
          ORDER BY al.created_at DESC
          LIMIT ${perPage} OFFSET ${offset}`,
        params
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM audit_log al WHERE ${whereSql}`, params),
    ]);

    res.json({
      success: true,
      data: list.rows,
      pagination: { page, per_page: perPage, total: total.rows[0].total },
    });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro ao consultar audit log', error);
  }
});

// GET /api/audit-log/actions — distinct list de ações para dropdown de filtro.
router.get('/actions', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT DISTINCT action FROM audit_log WHERE salao_id = $1 ORDER BY action`,
      [req.salaoId]
    );
    res.json({ success: true, data: r.rows.map((x) => x.action) });
  } catch (error) {
    require('../utils/sendError').sendError(res, 500, 'Erro', error);
  }
});

module.exports = router;
