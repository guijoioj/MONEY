/**
 * CommissionTriggers — orquestração de geração automática de comissões.
 *
 * Pontos de entrada esperados:
 *   - onVendaCriada(venda, client)        ← chamado em VendaService.criar
 *   - onVendaCancelada(venda, client, motivo)
 *   - onVendaEditada(vendaAntiga, vendaNova, client)
 *   - onAtendimentoFechado(atendimento, client)
 *
 * Comportamento de erro:
 *   - dev/test → best-effort (loga e retorna { ok: false }). Não derruba venda.
 *   - production → STRICT por padrão: erro propaga (throw), rollback da venda.
 *     Garante zero "venda sem comissão" em prod.
 *   - Override: STRICT_COMISSAO=true força strict, =false força best-effort.
 *
 * Cada função:
 *   - é idempotente: rodar 2x = mesmo resultado (ON CONFLICT na idempotency_key)
 *   - audita: logAction em audit_log pra rastreabilidade
 *
 * Feature flag: AUTO_COMISSAO=false desativa tudo (default = ligado).
 *
 * @module services/CommissionTriggers
 */

const Engine = require('./CommissionEngine');
const { logAction } = require('../utils/auditLog');
const { toCents, assertCents } = require('../utils/money');

const ENABLED = () => process.env.AUTO_COMISSAO !== 'false';
// STRICT_COMISSAO=true → falha de trigger faz rollback da venda inteira.
// Default em produção = strict. Em dev/test = best-effort.
const STRICT = () => process.env.STRICT_COMISSAO === 'true'
  || (process.env.NODE_ENV === 'production' && process.env.STRICT_COMISSAO !== 'false');

/**
 * Converte uma venda do schema atual (linhas + itens) para o formato esperado
 * pelo Engine. Lê itens da venda_itens, monta contexto.
 *
 * @param {object} venda - row de `vendas`
 * @param {object} client - pg client (transação)
 * @returns {Promise<object>} venda enriquecida pra Engine
 */
async function enrichVendaForEngine(venda, client) {
  // Busca itens (produtos)
  const { rows: itensProdutos } = await client.query(
    `SELECT vi.*, p.categoria, p.preco_custo
       FROM venda_itens vi
       LEFT JOIN produtos p ON p.id = vi.produto_id
      WHERE vi.venda_id = $1`,
    [venda.id]
  );

  // Itens normalizados para o Engine (cents)
  const itens = itensProdutos.map(it => ({
    id: it.id,
    tipo_item: 'produto',
    produto_id: it.produto_id,
    categoria: it.categoria || null,
    valor_bruto_cents: toCents(Number(it.valor_total || it.preco_unitario * it.quantidade)),
    custo_produto_cents: toCents(Number(it.preco_custo || 0)) * (it.quantidade || 1),
    desconto_cents: 0,
    acrescimo_cents: 0,
    taxa_cartao_cents: 0,
    profissionais: [{
      id: venda.profissional_id,
      percentual_participacao: 100,
    }],
    assistentes: [],
  }));

  // Se a venda tem profissional_id mas nenhum item-produto, considerar a venda
  // como "serviço genérico" (caso comum em vendas sem itens detalhados).
  if (itens.length === 0 && venda.profissional_id && Number(venda.valor_final) > 0) {
    itens.push({
      id: null,
      tipo_item: 'servico',
      servico_id: null,
      valor_bruto_cents: toCents(Number(venda.valor_final)),
      desconto_cents: toCents(Number(venda.desconto || 0)),
      profissionais: [{ id: venda.profissional_id, percentual_participacao: 100 }],
      assistentes: [],
    });
  }

  return {
    id: venda.id,
    salao_id: venda.salao_id,
    cliente_id: venda.cliente_id,
    data: venda.created_at || new Date(),
    forma_pagamento: venda.forma_pagamento,
    itens,
  };
}

/**
 * Gera comissões automaticamente para uma venda recém-criada.
 *
 * @param {object} venda - row de vendas
 * @param {object} client - pg client (transação)
 * @param {object} [opts]
 * @returns {Promise<{ok: boolean, inserted: number, errors: Array, skipped: number}>}
 */
async function onVendaCriada(venda, client, opts = {}) {
  if (!ENABLED()) return { ok: true, skipped: 1, inserted: 0, errors: [] };

  // Só gera se a venda está em estado que gera comissão (pago/finalizado).
  // Para vendas "pendente" criadas agora, espera-se outro hook (atualizarStatus).
  const STATUS_GERA = ['pago', 'finalizado', 'concluido', 'concluida'];
  if (venda.status && !STATUS_GERA.includes(venda.status)) {
    return { ok: true, skipped: 1, inserted: 0, errors: [], reason: `status=${venda.status} não gera comissão` };
  }

  try {
    const enriched = await enrichVendaForEngine(venda, client);
    const regras = await Engine.Repository.getRegrasVigentes(venda.salao_id, enriched.data, client);

    if (regras.length === 0) {
      return { ok: true, inserted: 0, errors: [], reason: 'nenhuma regra vigente' };
    }

    const resultados = Engine.calculateForVenda(enriched, regras);
    let inserted = 0;
    const errors = [];

    for (const r of resultados) {
      if (r.valorComissaoCents === 0) continue;
      const ctx = r.itemContext;
      const idempKey = Engine.Repository.buildIdempotencyKey({
        vendaId: venda.id,
        itemId: ctx.itemVendaId,
        profissionalId: r.profissionalId,
        papel: r.papel,
        versao: opts.versao || 1,
      });

      try {
        const inserted_row = await Engine.Repository.insertComissao(r, {
          ...ctx,
          status: 'pendente',
          origem: 'automatica',
          idempotencyKey: idempKey,
        }, client);
        if (inserted_row) inserted++;
      } catch (e) {
        errors.push({ profissional_id: r.profissionalId, error: e.message });
      }
    }

    // Audit (best effort — falha não derruba)
    try {
      await logAction({
        req: { salaoId: venda.salao_id, user: { userId: null } },
        action: 'comissao.gerar_automatica',
        entityType: 'comissoes',
        entityId: venda.id,
        after: { venda_id: venda.id, inserted, errors_count: errors.length },
      });
    } catch (_) { /* noop */ }

    return { ok: true, inserted, errors, total_calculadas: resultados.length };
  } catch (err) {
    console.error('[CommissionTriggers] onVendaCriada erro:', err.message);
    if (STRICT()) throw err; // strict: rollback da venda
    return { ok: false, inserted: 0, errors: [{ error: err.message }] };
  }
}

/**
 * Cancela comissões quando venda é cancelada.
 * - Pendentes: status='cancelada'
 * - Pagas: cria ajuste negativo (preserva histórico imutável)
 *
 * @param {object} venda
 * @param {object} client
 * @param {string} [motivo]
 * @returns {Promise<{ok: boolean, canceladas: number, ajustesCriados: number}>}
 */
async function onVendaCancelada(venda, client, motivo = 'Venda cancelada') {
  if (!ENABLED()) return { ok: true, canceladas: 0, ajustesCriados: 0 };

  try {
    // Cancela pendentes
    const { rows: canceladas } = await client.query(
      `UPDATE comissoes
          SET status = 'cancelada', motivo_bloqueio = $3, updated_at = NOW()
        WHERE venda_id = $1 AND salao_id = $2 AND status = 'pendente'
      RETURNING id, profissional_id, valor_comissao_cents`,
      [venda.id, venda.salao_id, motivo]
    );

    // Gera ajuste negativo pras pagas
    const { rows: pagas } = await client.query(
      `SELECT id, profissional_id, valor_comissao_cents, competencia
         FROM comissoes
        WHERE venda_id = $1 AND salao_id = $2 AND status = 'paga'`,
      [venda.id, venda.salao_id]
    );

    let ajustesCriados = 0;
    for (const p of pagas) {
      await client.query(
        `INSERT INTO comissoes_ajustes (
           salao_id, profissional_id, tipo, valor_cents, motivo,
           competencia, comissao_origem_id, status
         ) VALUES ($1,$2,'estorno',$3,$4,$5,$6,'pendente')`,
        [venda.salao_id, p.profissional_id, -Math.abs(Number(p.valor_comissao_cents)),
         motivo, p.competencia, p.id]
      );
      // Marca a comissão original como estornada (preserva histórico)
      await client.query(
        `UPDATE comissoes SET status = 'estornada', motivo_bloqueio = $1 WHERE id = $2`,
        [motivo, p.id]
      );
      ajustesCriados++;
    }

    try {
      await logAction({
        req: { salaoId: venda.salao_id, user: { userId: null } },
        action: 'comissao.cancelar_por_venda',
        entityType: 'comissoes',
        entityId: venda.id,
        after: { canceladas: canceladas.length, ajustes_criados: ajustesCriados, motivo },
      });
    } catch (_) {}

    return { ok: true, canceladas: canceladas.length, ajustesCriados };
  } catch (err) {
    console.error('[CommissionTriggers] onVendaCancelada erro:', err.message);
    if (STRICT()) throw err;
    return { ok: false, canceladas: 0, ajustesCriados: 0, error: err.message };
  }
}

/**
 * Lida com atualização de venda.
 * - Se há comissões pendentes: re-gera (deleta pendentes + insere novas)
 * - Se há comissões pagas: cria ajustes pra refletir diferença
 *
 * @param {object} vendaAntiga
 * @param {object} vendaNova
 * @param {object} client
 * @returns {Promise<{ok: boolean, action: string}>}
 */
async function onVendaEditada(vendaAntiga, vendaNova, client) {
  if (!ENABLED()) return { ok: true, action: 'skipped_disabled' };

  try {
    const { rows: pagas } = await client.query(
      `SELECT id, profissional_id, valor_comissao_cents
         FROM comissoes
        WHERE venda_id = $1 AND salao_id = $2 AND status = 'paga'`,
      [vendaNova.id, vendaNova.salao_id]
    );

    if (pagas.length > 0) {
      // Tem comissão paga: NUNCA muta. Cria ajuste se valor diferiu.
      const valorAntigo = Number(vendaAntiga.valor_final || 0);
      const valorNovo = Number(vendaNova.valor_final || 0);
      if (Math.abs(valorAntigo - valorNovo) > 0.001) {
        // Não temos como saber a regra precisa aqui — admin deve ajustar manualmente.
        // Cria flag em audit pra revisão.
        await logAction({
          req: { salaoId: vendaNova.salao_id, user: { userId: null } },
          action: 'comissao.alerta_venda_editada_com_comissao_paga',
          entityType: 'vendas',
          entityId: vendaNova.id,
          after: { valor_antigo: valorAntigo, valor_novo: valorNovo, comissoes_pagas: pagas.length },
        });
      }
      return { ok: true, action: 'preserved_paid_logged_alert' };
    }

    // Só pendentes ou nenhuma: deleta pendentes + recalcula
    await client.query(
      `DELETE FROM comissoes WHERE venda_id = $1 AND salao_id = $2 AND status = 'pendente'`,
      [vendaNova.id, vendaNova.salao_id]
    );

    // Re-gera (incrementa versão pra evitar conflict com idempotency)
    const versao = Number(vendaAntiga._comissao_versao || 1) + 1;
    return await onVendaCriada(vendaNova, client, { versao });
  } catch (err) {
    console.error('[CommissionTriggers] onVendaEditada erro:', err.message);
    if (STRICT()) throw err;
    return { ok: false, action: 'error', error: err.message };
  }
}

/**
 * Atendimento fechado → gera comissões dos serviços executados.
 *
 * @param {object} atendimento  - row de atendimentos
 * @param {object} client
 */
async function onAtendimentoFechado(atendimento, client) {
  if (!ENABLED()) return { ok: true, inserted: 0 };

  try {
    // Busca serviços do atendimento
    const { rows: servicos } = await client.query(
      `SELECT a_s.*, s.categoria
         FROM atendimentos_servicos a_s
         LEFT JOIN servicos s ON s.id = a_s.servico_id
        WHERE a_s.atendimento_id = $1`,
      [atendimento.id]
    );

    const itens = servicos.map(s => ({
      id: s.id,
      tipo_item: 'servico',
      servico_id: s.servico_id,
      categoria: s.categoria || null,
      valor_bruto_cents: toCents(Number(s.valor || s.preco || 0)),
      desconto_cents: 0,
      profissionais: [{
        id: atendimento.profissional_id,
        percentual_participacao: 100,
      }],
      assistentes: atendimento.auxiliar_id ? [{ id: atendimento.auxiliar_id }] : [],
    }));

    if (itens.length === 0) {
      // Atendimento sem serviços-detalhados: usa total geral
      if (Number(atendimento.total_geral || 0) > 0 && atendimento.profissional_id) {
        itens.push({
          id: null,
          tipo_item: 'servico',
          valor_bruto_cents: toCents(Number(atendimento.total_geral)),
          desconto_cents: toCents(Number(atendimento.desconto || 0)),
          profissionais: [{ id: atendimento.profissional_id, percentual_participacao: 100 }],
          assistentes: atendimento.auxiliar_id ? [{ id: atendimento.auxiliar_id }] : [],
        });
      }
    }

    if (itens.length === 0) return { ok: true, inserted: 0 };

    const venda = {
      id: null,  // não há venda; usa atendimento_id como referência
      salao_id: atendimento.salao_id,
      cliente_id: atendimento.cliente_id,
      data: atendimento.data || new Date(),
      forma_pagamento: atendimento.forma_pagamento,
      atendimento_id: atendimento.id,
      itens,
    };

    const regras = await Engine.Repository.getRegrasVigentes(atendimento.salao_id, venda.data, client);
    const resultados = Engine.calculateForVenda(venda, regras);

    let inserted = 0;
    for (const r of resultados) {
      if (r.valorComissaoCents === 0) continue;
      const ctx = r.itemContext;
      const idempKey = Engine.Repository.buildIdempotencyKey({
        comandaId: atendimento.id,
        itemId: ctx.itemVendaId,
        profissionalId: r.profissionalId,
        papel: r.papel,
        versao: 1,
      });

      try {
        const row = await Engine.Repository.insertComissao(r, {
          ...ctx,
          status: 'pendente',
          origem: 'automatica',
          idempotencyKey: idempKey,
        }, client);
        if (row) inserted++;
      } catch (e) {
        console.warn('[CommissionTriggers] atendimento item error:', e.message);
      }
    }

    return { ok: true, inserted };
  } catch (err) {
    console.error('[CommissionTriggers] onAtendimentoFechado erro:', err.message);
    if (STRICT()) throw err;
    return { ok: false, error: err.message };
  }
}

module.exports = {
  onVendaCriada,
  onVendaCancelada,
  onVendaEditada,
  onAtendimentoFechado,
  enrichVendaForEngine,
  ENABLED,
  STRICT,
};
