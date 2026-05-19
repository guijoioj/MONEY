/**
 * /api/v2/comissoes/regras — CRUD de regras_comissao.
 *
 * Apenas admin pode criar/editar/duplicar/desativar.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../../middleware/auth');
const { pool, withTransaction } = require('../../config/database');
const { logAction } = require('../../utils/auditLog');
const { sendError } = require('../../utils/sendError');

const TIPOS_VALIDOS = [
  'global','profissional','servico','produto',
  'categoria_servico','categoria_produto',
  'profissional_servico','profissional_produto',
  'assistente','meta','dia_semana','horario',
];

const BASES_VALIDAS = [
  'valor_bruto','valor_com_desconto','valor_liquido',
  'valor_liquido_sem_taxas','lucro_bruto',
];

function validateRegra(body) {
  const errors = [];
  if (!body.nome || body.nome.trim().length === 0) errors.push('nome obrigatório');
  if (!body.tipo || !TIPOS_VALIDOS.includes(body.tipo)) errors.push(`tipo inválido. Valores: ${TIPOS_VALIDOS.join(', ')}`);
  if (!body.base_calculo || !BASES_VALIDAS.includes(body.base_calculo)) errors.push(`base_calculo inválida. Valores: ${BASES_VALIDAS.join(', ')}`);

  const temPercentual = body.percentual != null && body.percentual !== '';
  const temFixo = body.valor_fixo_cents != null && body.valor_fixo_cents !== '';
  if (temPercentual === temFixo) errors.push('forneça percentual XOR valor_fixo_cents');

  if (temPercentual) {
    const p = Number(body.percentual);
    if (!Number.isFinite(p) || p < 0 || p > 100) errors.push('percentual deve estar entre 0 e 100');
  }
  if (temFixo) {
    const v = Number(body.valor_fixo_cents);
    if (!Number.isInteger(v) || v < 0) errors.push('valor_fixo_cents deve ser integer >= 0');
  }

  if (body.data_fim && body.data_inicio && body.data_fim < body.data_inicio) {
    errors.push('data_fim anterior a data_inicio');
  }

  return errors;
}

// ============================================================================
// GET /api/v2/comissoes/regras — lista com filtros
// ============================================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tipo, ativo, profissional_id, servico_id, produto_id, categoria } = req.query;
    let sql = 'SELECT * FROM regras_comissao WHERE salao_id = $1';
    const params = [req.salaoId];
    let p = 2;

    if (tipo)            { sql += ` AND tipo = $${p++}`; params.push(tipo); }
    if (ativo !== undefined) { sql += ` AND ativo = $${p++}`; params.push(ativo === 'true'); }
    if (profissional_id) { sql += ` AND profissional_id = $${p++}`; params.push(profissional_id); }
    if (servico_id)      { sql += ` AND servico_id = $${p++}`; params.push(servico_id); }
    if (produto_id)      { sql += ` AND produto_id = $${p++}`; params.push(produto_id); }
    if (categoria)       { sql += ` AND categoria = $${p++}`; params.push(categoria); }

    sql += ' ORDER BY prioridade DESC, tipo, nome';
    const { rows } = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    sendError(res, 500, 'Erro listando regras', error);
  }
});

// ============================================================================
// GET /:id — detalhe (com faixas se tipo=meta)
// ============================================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM regras_comissao WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Regra não encontrada' });

    let faixas = [];
    if (rows[0].tipo === 'meta') {
      const r = await pool.query(
        'SELECT * FROM metas_comissao_faixas WHERE regra_id = $1 ORDER BY ordem',
        [req.params.id]
      );
      faixas = r.rows;
    }

    res.json({ success: true, data: { ...rows[0], faixas } });
  } catch (error) {
    sendError(res, 500, 'Erro', error);
  }
});

// ============================================================================
// POST / — criar regra
// ============================================================================
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const errors = validateRegra(req.body);
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('; ') });

    const result = await withTransaction(async (client) => {
      // Insere regra
      const { rows } = await client.query(
        `INSERT INTO regras_comissao (
           salao_id, nome, descricao, tipo,
           profissional_id, servico_id, produto_id, categoria,
           base_calculo, percentual, valor_fixo_cents,
           data_inicio, data_fim, ativo, prioridade,
           condicoes_json, criado_por
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          req.salaoId, req.body.nome, req.body.descricao || null, req.body.tipo,
          req.body.profissional_id || null,
          req.body.servico_id || null,
          req.body.produto_id || null,
          req.body.categoria || null,
          req.body.base_calculo,
          req.body.percentual != null ? Number(req.body.percentual) : null,
          req.body.valor_fixo_cents != null ? Number(req.body.valor_fixo_cents) : null,
          req.body.data_inicio || new Date().toISOString().slice(0, 10),
          req.body.data_fim || null,
          req.body.ativo !== false,
          req.body.prioridade ?? 0,
          JSON.stringify(req.body.condicoes_json || {}),
          req.user?.userId || null,
        ]
      );
      const regra = rows[0];

      // Se for meta, insere faixas
      if (req.body.tipo === 'meta' && Array.isArray(req.body.faixas)) {
        for (const [idx, f] of req.body.faixas.entries()) {
          await client.query(
            `INSERT INTO metas_comissao_faixas (
               regra_id, ordem, faixa_inicio_cents, faixa_fim_cents,
               percentual, modo, tipo_base, periodo
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [regra.id, f.ordem ?? idx + 1, f.faixa_inicio_cents, f.faixa_fim_cents || null,
             f.percentual, f.modo || 'progressivo', f.tipo_base || 'faturamento_cents',
             f.periodo || 'mensal']
          );
        }
      }

      await logAction({
        req, action: 'regra_comissao.criar',
        entityType: 'regras_comissao',
        entityId: regra.id, after: regra,
      });

      return regra;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    sendError(res, 500, 'Erro criando regra', error);
  }
});

// ============================================================================
// PUT /:id — editar
// ============================================================================
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    // Snapshot before pra audit
    const before = await pool.query(
      'SELECT * FROM regras_comissao WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    if (!before.rows.length) return res.status(404).json({ success: false, error: 'Não encontrada' });

    const errors = validateRegra({ ...before.rows[0], ...req.body });
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('; ') });

    const { rows } = await pool.query(
      `UPDATE regras_comissao
          SET nome = COALESCE($1, nome),
              descricao = COALESCE($2, descricao),
              percentual = COALESCE($3, percentual),
              valor_fixo_cents = COALESCE($4, valor_fixo_cents),
              data_inicio = COALESCE($5, data_inicio),
              data_fim = $6,
              ativo = COALESCE($7, ativo),
              prioridade = COALESCE($8, prioridade),
              condicoes_json = COALESCE($9, condicoes_json),
              base_calculo = COALESCE($10, base_calculo),
              updated_at = NOW()
        WHERE id = $11 AND salao_id = $12
      RETURNING *`,
      [
        req.body.nome, req.body.descricao,
        req.body.percentual != null ? Number(req.body.percentual) : null,
        req.body.valor_fixo_cents != null ? Number(req.body.valor_fixo_cents) : null,
        req.body.data_inicio,
        req.body.data_fim || null,
        req.body.ativo,
        req.body.prioridade,
        req.body.condicoes_json ? JSON.stringify(req.body.condicoes_json) : null,
        req.body.base_calculo,
        req.params.id, req.salaoId,
      ]
    );

    await logAction({
      req, action: 'regra_comissao.atualizar',
      entityType: 'regras_comissao',
      entityId: Number(req.params.id),
      before: before.rows[0], after: rows[0],
    });

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    sendError(res, 500, 'Erro editando regra', error);
  }
});

// ============================================================================
// DELETE /:id — soft delete (ativo = false)
// ============================================================================
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE regras_comissao SET ativo = false, updated_at = NOW() WHERE id = $1 AND salao_id = $2 RETURNING *',
      [req.params.id, req.salaoId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Não encontrada' });

    await logAction({
      req, action: 'regra_comissao.desativar',
      entityType: 'regras_comissao', entityId: rows[0].id, after: rows[0],
    });

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    sendError(res, 500, 'Erro', error);
  }
});

// ============================================================================
// POST /:id/clonar — duplica pra editar
// ============================================================================
router.post('/:id/clonar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orig = await pool.query(
      'SELECT * FROM regras_comissao WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    if (!orig.rows.length) return res.status(404).json({ success: false, error: 'Original não encontrada' });

    const o = orig.rows[0];
    const { rows } = await pool.query(
      `INSERT INTO regras_comissao (
         salao_id, nome, descricao, tipo,
         profissional_id, servico_id, produto_id, categoria,
         base_calculo, percentual, valor_fixo_cents,
         data_inicio, data_fim, ativo, prioridade,
         condicoes_json, criado_por
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,$14,$15,$16)
       RETURNING *`,
      [
        o.salao_id, `${o.nome} (cópia)`, o.descricao, o.tipo,
        o.profissional_id, o.servico_id, o.produto_id, o.categoria,
        o.base_calculo, o.percentual, o.valor_fixo_cents,
        new Date().toISOString().slice(0, 10), null,
        o.prioridade, o.condicoes_json, req.user?.userId || null,
      ]
    );

    await logAction({
      req, action: 'regra_comissao.clonar',
      entityType: 'regras_comissao', entityId: rows[0].id, after: rows[0],
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    sendError(res, 500, 'Erro clonando', error);
  }
});

module.exports = router;
