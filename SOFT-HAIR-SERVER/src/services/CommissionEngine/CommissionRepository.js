/**
 * CommissionRepository — camada de persistência. Única parte com DB.
 *
 * O engine puro retorna calculations. Repository converte em INSERT/UPDATE.
 *
 * @module services/CommissionEngine/CommissionRepository
 */

const { pool, withTransaction } = require('../../config/database');
const { assertCents } = require('../../utils/money');

/**
 * Busca regras ativas e vigentes para o salão.
 *
 * @param {number} salaoId
 * @param {Date} [data=new Date()]  - data de referência pra vigência
 * @param {object} [client]  - opcional, pra transação
 * @returns {Promise<Array<object>>}
 */
async function getRegrasVigentes(salaoId, data = new Date(), client = pool) {
  const dataStr = data instanceof Date ? data.toISOString().slice(0, 10) : data;
  const { rows } = await client.query(
    `SELECT * FROM regras_comissao
      WHERE salao_id = $1
        AND ativo = true
        AND data_inicio <= $2
        AND (data_fim IS NULL OR data_fim >= $2)
      ORDER BY prioridade DESC, data_inicio DESC`,
    [salaoId, dataStr]
  );
  return rows;
}

/**
 * Busca regra de meta + suas faixas.
 * @param {number} regraId
 * @param {object} [client]
 * @returns {Promise<{regra: object, faixas: Array}|null>}
 */
async function getRegraMeta(regraId, client = pool) {
  const { rows: regraRows } = await client.query(
    'SELECT * FROM regras_comissao WHERE id = $1 AND tipo = $2',
    [regraId, 'meta']
  );
  if (regraRows.length === 0) return null;

  const { rows: faixas } = await client.query(
    'SELECT * FROM metas_comissao_faixas WHERE regra_id = $1 ORDER BY ordem',
    [regraId]
  );

  return { regra: regraRows[0], faixas };
}

/**
 * Insere comissão no banco. ON CONFLICT DO NOTHING via idempotency_key.
 *
 * @param {object} result  - resultado do engine
 * @param {object} ctx  - contexto adicional (salao_id, venda_id, etc)
 * @param {object} client  - cliente pg (transação obrigatória)
 * @returns {Promise<object|null>}  - row inserida ou null se conflito
 */
async function insertComissao(result, ctx, client) {
  assertCents(result.valorComissaoCents);
  assertCents(result.valorBaseCents);

  const { rows } = await client.query(
    `INSERT INTO comissoes (
       salao_id, profissional_id, venda_id, comanda_id, item_venda_id, cliente_id,
       servico_id, produto_id, tipo_item, papel_profissional, percentual_participacao,
       valor_total, percentual, valor_comissao,
       valor_bruto_cents, desconto_cents, acrescimo_cents, taxa_cartao_cents,
       custo_produto_cents, valor_base_cents, valor_comissao_cents, valor_fixo_cents,
       base_calculo, regra_id, regra_snapshot_json, status,
       competencia, data_geracao, origem, idempotency_key
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
       $12,$13,$14,
       $15,$16,$17,$18,$19,$20,$21,$22,
       $23,$24,$25,$26,$27,$28,$29,$30
     )
     ON CONFLICT (salao_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      ctx.salaoId, result.profissionalId, ctx.vendaId || null, ctx.comandaId || null,
      ctx.itemVendaId || null, ctx.clienteId || null,
      ctx.servicoId || null, ctx.produtoId || null, ctx.tipoItem || null,
      result.papel, result.percentualParticipacao,
      // legacy compat: valor_total decimal, percentual decimal, valor_comissao decimal
      (result.valorBaseCents / 100).toFixed(2),
      result.percentual,
      (result.valorComissaoCents / 100).toFixed(2),
      // cents
      ctx.valorBrutoCents || 0,
      ctx.descontoCents || 0,
      ctx.acrescimoCents || 0,
      ctx.taxaCartaoCents || 0,
      ctx.custoProdutoCents || 0,
      result.valorBaseCents,
      result.valorComissaoCents,
      result.valorFixoCents,
      result.baseCalculo,
      result.regraId,
      result.regraSnapshot ? JSON.stringify(result.regraSnapshot) : null,
      ctx.status || 'pendente',
      ctx.competencia || (ctx.dataAtendimento ? new Date(ctx.dataAtendimento).toISOString().slice(0, 7) + '-01' : null),
      ctx.dataAtendimento || new Date(),
      ctx.origem || 'automatica',
      ctx.idempotencyKey,
    ]
  );

  return rows[0] || null;
}

/**
 * Constrói idempotency_key padronizado.
 */
function buildIdempotencyKey({ vendaId, comandaId, itemId, profissionalId, papel, versao = 1 }) {
  const origem = vendaId ? `venda:${vendaId}` : `comanda:${comandaId}`;
  return `${origem}:item:${itemId || 'null'}:prof:${profissionalId}:papel:${papel}:v:${versao}`;
}

/**
 * Marca comissões como canceladas/estornadas em massa pra uma venda.
 *
 * @param {number} vendaId
 * @param {number} salaoId
 * @param {'cancelada'|'estornada'} novoStatus
 * @param {object} client
 * @returns {Promise<Array<object>>}  - linhas afetadas
 */
async function changeStatusByVenda(vendaId, salaoId, novoStatus, client) {
  const filtroOrigem = novoStatus === 'cancelada'
    ? `status = 'pendente'`
    : `status = 'paga'`;

  const { rows } = await client.query(
    `UPDATE comissoes
        SET status = $3, updated_at = NOW()
      WHERE venda_id = $1 AND salao_id = $2 AND ${filtroOrigem}
    RETURNING *`,
    [vendaId, salaoId, novoStatus]
  );
  return rows;
}

/**
 * Insere ajuste financeiro (bonus/desconto/adiantamento/correcao/meta_retroativa/estorno).
 *
 * @param {object} data
 * @param {object} client
 * @returns {Promise<object>}
 */
async function insertAjuste(data, client) {
  const { rows } = await client.query(
    `INSERT INTO comissoes_ajustes (
       salao_id, profissional_id, tipo, valor_cents, motivo, competencia,
       comissao_origem_id, pagamento_lote_id, status, criado_por
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      data.salaoId, data.profissionalId, data.tipo, data.valorCents,
      data.motivo, data.competencia || null,
      data.comissaoOrigemId || null, data.pagamentoLoteId || null,
      data.status || 'pendente', data.criadoPor || null,
    ]
  );
  return rows[0];
}

/**
 * Lista comissões de uma venda.
 */
async function getByVenda(vendaId, salaoId, client = pool) {
  const { rows } = await client.query(
    'SELECT * FROM comissoes WHERE venda_id = $1 AND salao_id = $2 ORDER BY id',
    [vendaId, salaoId]
  );
  return rows;
}

/**
 * Soma faturamento do profissional no período (pra meta).
 */
async function getFaturamentoProfissional(profissionalId, salaoId, periodoInicio, periodoFim, client = pool) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(valor_base_cents), 0)::bigint AS faturamento_cents,
            COUNT(*)::int AS quantidade
       FROM comissoes
      WHERE profissional_id = $1
        AND salao_id = $2
        AND data_geracao >= $3
        AND data_geracao <= $4
        AND status IN ('pendente','paga')`,
    [profissionalId, salaoId, periodoInicio, periodoFim]
  );
  return {
    faturamento_cents: Number(rows[0].faturamento_cents || 0),
    quantidade: rows[0].quantidade || 0,
  };
}

module.exports = {
  getRegrasVigentes,
  getRegraMeta,
  insertComissao,
  insertAjuste,
  buildIdempotencyKey,
  changeStatusByVenda,
  getByVenda,
  getFaturamentoProfissional,
};
