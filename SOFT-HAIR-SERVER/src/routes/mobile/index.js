/**
 * /api/mobile/* — endpoints leves pra o app React Native.
 *
 * Princípios:
 *   - Payload pequeno (mobile = banda limitada)
 *   - Paginação default (limit 20, max 50)
 *   - Multi-tenant via salao_id
 *   - Sempre authMiddleware
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { pool } = require('../../config/database');
const { sendError } = require('../../utils/sendError');

/**
 * Resolve profissional_id efetivo a partir do user + query.
 * Profissional não-admin → força próprio ID.
 * Admin com ?profissional_id=X → valida que X pertence ao salão.
 * Lança 403 se admin tentar acessar prof de outro salão.
 *
 * @returns {Promise<number|null>}
 */
async function resolveProfId(req, res) {
  // Hot-fix: JWT atual usa `tipo` ('admin'|'recepcao'|'profissional') e `profissionalId` (camelCase),
  // não `is_admin` / `profissional_id`. Mantém fallback nos snake_case por compat com tokens legados.
  const isAdmin = req.user?.tipo === 'admin' || req.user?.is_admin === true;
  const ownProfId = req.user?.profissionalId ?? req.user?.profissional_id ?? null;
  if (!isAdmin) return ownProfId;
  const requested = req.query.profissional_id;
  if (!requested) return ownProfId;
  // Validar tenancy
  const r = await pool.query(
    'SELECT id FROM profissionais WHERE id=$1 AND salao_id=$2',
    [requested, req.salaoId]
  );
  if (!r.rows.length) {
    res.status(403).json({ success: false, error: 'profissional_id não pertence ao salão' });
    return null;
  }
  return Number(requested);
}

// ─── GET /api/mobile/me ─────────────────────────────────────
// Retorna info do usuário logado + salão + dia atual de info útil.
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Tabela real é `usuarios` e a coluna de papel é `tipo`, não `is_admin`.
    const { rows: usr } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.tipo, u.profissional_id,
              s.id AS salao_id, s.nome AS salao_nome
         FROM usuarios u
         LEFT JOIN saloes s ON s.id = u.salao_id
        WHERE u.id = $1`,
      [req.user.userId]
    );
    if (!usr.length) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    const u = usr[0];
    res.json({ success: true, data: { ...u, role: u.tipo, is_admin: u.tipo === 'admin' } });
  } catch (error) { sendError(res, 500, 'Erro', error); }
});

// ─── GET /api/mobile/dashboard ──────────────────────────────
// Cards de admin/profissional resumidos.
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    // Hot-fix: usar `tipo`/`profissionalId` (camelCase do JWT atual) — `is_admin` não existe.
    const isAdmin = req.user?.tipo === 'admin';
    const profissionalId = req.user?.profissionalId ?? req.user?.profissional_id ?? null;
    const hoje = new Date().toISOString().slice(0, 10);

    if (isAdmin) {
      // Admin: faturamento hoje, agendamentos hoje, vendas hoje, comissões pendentes total
      const [fat, agend, vendas, comissoes] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(valor_final),0)::numeric AS valor
             FROM vendas WHERE salao_id=$1 AND DATE(created_at)=$2 AND status != 'cancelada'`,
          [req.salaoId, hoje]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS qtd FROM agendamentos
            WHERE salao_id=$1 AND data_inicio::date=$2`,
          [req.salaoId, hoje]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS qtd FROM vendas
            WHERE salao_id=$1 AND DATE(created_at)=$2`,
          [req.salaoId, hoje]
        ),
        pool.query(
          `SELECT COALESCE(SUM(valor_comissao_cents),0)::bigint AS total_cents
             FROM comissoes WHERE salao_id=$1 AND status='pendente'`,
          [req.salaoId]
        ),
      ]);
      return res.json({
        success: true,
        data: {
          role: 'admin',
          faturamento_hoje: Number(fat.rows[0].valor),
          agendamentos_hoje: agend.rows[0].qtd,
          vendas_hoje: vendas.rows[0].qtd,
          comissoes_pendentes_cents: Number(comissoes.rows[0].total_cents),
        },
      });
    }

    if (profissionalId) {
      // Profissional: atendimentos hoje, comissão pendente do mês, comissão paga mês
      const mes = hoje.slice(0, 7);
      const [atend, pend, pago] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS qtd FROM atendimentos
            WHERE salao_id=$1 AND profissional_id=$2 AND DATE(data_atendimento)=$3
              AND status != 'cancelado'`,
          [req.salaoId, profissionalId, hoje]
        ),
        pool.query(
          `SELECT COALESCE(SUM(valor_comissao_cents),0)::bigint AS cents
             FROM comissoes
            WHERE salao_id=$1 AND profissional_id=$2 AND status='pendente'
              AND competencia=$3::date`,
          [req.salaoId, profissionalId, `${mes}-01`]
        ),
        pool.query(
          `SELECT COALESCE(SUM(valor_comissao_cents),0)::bigint AS cents
             FROM comissoes
            WHERE salao_id=$1 AND profissional_id=$2 AND status='paga'
              AND competencia=$3::date`,
          [req.salaoId, profissionalId, `${mes}-01`]
        ),
      ]);
      return res.json({
        success: true,
        data: {
          role: 'profissional',
          atendimentos_hoje: atend.rows[0].qtd,
          comissao_pendente_mes_cents: Number(pend.rows[0].cents),
          comissao_paga_mes_cents: Number(pago.rows[0].cents),
        },
      });
    }

    res.json({ success: true, data: { role: 'desconhecido' } });
  } catch (error) { sendError(res, 500, 'Erro dashboard', error); }
});

// ─── GET /api/mobile/agenda ─────────────────────────────────
// Lista agendamentos do dia (filtros: data, profissional_id)
router.get('/agenda', authMiddleware, async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const profId = await resolveProfId(req, res);
    if (res.headersSent) return;

    let sql = `
      SELECT a.id, a.data_inicio, a.data_fim, a.status,
             c.nome AS cliente_nome, c.telefone AS cliente_telefone,
             s.nome AS servico_nome, p.nome AS profissional_nome
        FROM agendamentos a
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
       WHERE a.salao_id = $1 AND a.data_inicio::date = $2
    `;
    const params = [req.salaoId, data];
    if (profId) { sql += ` AND a.profissional_id = $3`; params.push(profId); }
    sql += ' ORDER BY a.data_inicio';

    const { rows } = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) { sendError(res, 500, 'Erro agenda', error); }
});

// ─── GET /api/mobile/comissoes/resumo ───────────────────────
router.get('/comissoes/resumo', authMiddleware, async (req, res) => {
  try {
    const profId = await resolveProfId(req, res);
    if (res.headersSent) return;
    if (!profId) return res.status(400).json({ success: false, error: 'profissional_id obrigatório' });

    const { competencia } = req.query;
    const compArg = competencia
      ? (competencia.length === 7 ? `${competencia}-01` : competencia)
      : new Date().toISOString().slice(0, 7) + '-01';

    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status='pendente' THEN valor_comissao_cents ELSE 0 END),0)::bigint AS pendente_cents,
         COALESCE(SUM(CASE WHEN status='paga' THEN valor_comissao_cents ELSE 0 END),0)::bigint AS pago_cents,
         COUNT(*) FILTER (WHERE status='pendente')::int AS qtd_pendente,
         COUNT(*) FILTER (WHERE status='paga')::int AS qtd_paga
        FROM comissoes
       WHERE salao_id=$1 AND profissional_id=$2 AND competencia=$3::date`,
      [req.salaoId, profId, compArg]
    );

    res.json({ success: true, data: { ...rows[0], competencia: compArg } });
  } catch (error) { sendError(res, 500, 'Erro resumo', error); }
});

// ─── GET /api/mobile/comissoes/extrato ──────────────────────
router.get('/comissoes/extrato', authMiddleware, async (req, res) => {
  try {
    const profId = await resolveProfId(req, res);
    if (res.headersSent) return;
    if (!profId) return res.status(400).json({ success: false, error: 'profissional_id obrigatório' });

    const limit = Math.min(Number(req.query.limit) || 30, 50);
    const offset = Number(req.query.offset) || 0;

    const { rows } = await pool.query(
      `SELECT c.id, c.valor_comissao_cents, c.percentual, c.papel_profissional,
              c.status, c.data_geracao, c.competencia,
              cl.nome AS cliente_nome, s.nome AS servico_nome, p.nome AS produto_nome
         FROM comissoes c
         LEFT JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN servicos s ON s.id = c.servico_id
         LEFT JOIN produtos p ON p.id = c.produto_id
        WHERE c.salao_id=$1 AND c.profissional_id=$2
        ORDER BY c.data_geracao DESC
        LIMIT $3 OFFSET $4`,
      [req.salaoId, profId, limit, offset]
    );

    res.json({ success: true, data: rows, limit, offset, has_more: rows.length === limit });
  } catch (error) { sendError(res, 500, 'Erro extrato', error); }
});

// ─── GET /api/mobile/notificacoes ───────────────────────────
router.get('/notificacoes', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const { rows } = await pool.query(
      `SELECT id, titulo, mensagem, tipo, lida, created_at
         FROM notificacoes
        WHERE salao_id=$1 AND (user_id=$2 OR user_id IS NULL)
        ORDER BY created_at DESC
        LIMIT $3`,
      [req.salaoId, req.user.userId, limit]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    // Tabela pode não existir em alguns ambientes
    res.json({ success: true, data: [] });
  }
});

module.exports = router;
