/**
 * CommissionEngine — API pública.
 *
 * Pontos de entrada:
 *   - calculate(ctx, regras): calcula 1 comissão pura
 *   - calculateForItem(itemCtx, profissionais, assistentes, regras): item completo
 *   - calculateForVenda(venda, regras): venda completa, todos os itens
 *
 * Camada de persistência: CommissionRepository.
 *
 * Filosofia:
 *   - funções calculate* são PURAS (não tocam DB)
 *   - Repository.* é a única coisa que conecta
 *   - integração com VendaService combina os dois
 *
 * @module services/CommissionEngine
 */

const RuleResolver = require('./RuleResolver');
const BaseExtractor = require('./BaseExtractor');
const Calculator = require('./Calculator');
const SplitCalculator = require('./SplitCalculator');
const AssistantCalculator = require('./AssistantCalculator');
const MetaCalculator = require('./MetaCalculator');
const Repository = require('./CommissionRepository');

/**
 * Calcula 1 comissão pura (1 profissional, 1 item, 1 papel).
 *
 * @param {object} ctx
 * @param {Array<object>} regras
 * @returns {object|null}  - resultado ou null se nenhuma regra aplicou
 */
function calculate(ctx, regras) {
  const regra = RuleResolver.resolve(ctx, regras);
  if (!regra) {
    return {
      profissionalId: ctx.profissionalId,
      papel: ctx.papel,
      percentualParticipacao: ctx.percentualParticipacao || 100,
      valorBaseCents: 0,
      valorComissaoCents: 0,
      regraId: null,
      regraSnapshot: null,
      baseCalculo: null,
      percentual: null,
      valorFixoCents: null,
      trace: 'no_rule_matched',
    };
  }

  const valorBaseCents = BaseExtractor.extract(ctx, regra.base_calculo);
  let valorComissaoCents = Calculator.calculate(valorBaseCents, regra);

  // aplica participação se splitting
  const participacao = ctx.percentualParticipacao ?? 100;
  if (participacao !== 100) {
    valorComissaoCents = Calculator.applyParticipation(valorComissaoCents, participacao);
  }

  return {
    profissionalId: ctx.profissionalId,
    papel: ctx.papel,
    percentualParticipacao: participacao,
    valorBaseCents,
    valorComissaoCents,
    regraId: regra.id,
    regra,
    regraSnapshot: SplitCalculator.snapshotRegra
      ? SplitCalculator.snapshotRegra(regra)
      : snapshotRegra(regra),
    baseCalculo: regra.base_calculo,
    percentual: regra.percentual,
    valorFixoCents: regra.valor_fixo_cents,
    trace: 'single_rule_applied',
  };
}

function snapshotRegra(regra) {
  return {
    id: regra.id,
    nome: regra.nome,
    tipo: regra.tipo,
    base_calculo: regra.base_calculo,
    percentual: regra.percentual,
    valor_fixo_cents: regra.valor_fixo_cents,
    condicoes_json: regra.condicoes_json,
    snapshot_at: new Date().toISOString(),
  };
}

/**
 * Calcula comissões para 1 item de venda completo.
 *
 * @param {object} itemCtx
 * @param {Array<{id, papel?, percentual_participacao?}>} profissionais
 * @param {Array<{id}>} assistentes
 * @param {Array<object>} regras
 * @returns {Array<object>}
 */
function calculateForItem(itemCtx, profissionais, assistentes, regras) {
  const principais = SplitCalculator.calculateSplit(itemCtx, profissionais, regras);

  // Pra calcular assistente sobre comissão do principal, escolhemos o principal
  // com maior participacao (default 100% se só 1 profissional)
  const principalRef = principais[0] || null;
  const assistentesResult = AssistantCalculator.calculateAssistant(
    itemCtx, assistentes, principalRef, regras
  );

  return [...principais, ...assistentesResult];
}

/**
 * Calcula comissões pra venda inteira (todos os itens × todos os profissionais).
 *
 * @param {object} venda
 * @param {Array<object>} venda.itens  - [{ id, tipo_item, servico_id, produto_id, valor_bruto_cents, ...
 *                                        profissionais:[{id, papel?, percentual_participacao?}],
 *                                        assistentes:[{id}] }]
 * @param {Array<object>} regras
 * @returns {Array<object>}  - 1 entry por (item × profissional)
 */
function calculateForVenda(venda, regras) {
  if (!Array.isArray(venda.itens) || venda.itens.length === 0) return [];

  const resultados = [];
  for (const item of venda.itens) {
    const itemCtx = buildItemCtx(venda, item);
    const profissionais = item.profissionais || [{ id: item.profissional_id, percentual_participacao: 100 }];
    const assistentes = item.assistentes || [];

    const itemResultados = calculateForItem(itemCtx, profissionais, assistentes, regras);

    // Anexa contexto do item em cada resultado pra persistência depois
    for (const r of itemResultados) {
      resultados.push({
        ...r,
        itemContext: itemCtx,
      });
    }
  }
  return resultados;
}

function buildItemCtx(venda, item) {
  return {
    salaoId: venda.salao_id,
    vendaId: venda.id,
    comandaId: venda.atendimento_id || venda.comanda_id || null,
    itemVendaId: item.id,
    clienteId: venda.cliente_id,
    servicoId: item.servico_id || null,
    produtoId: item.produto_id || null,
    tipoItem: item.tipo_item || (item.servico_id ? 'servico' : item.produto_id ? 'produto' : null),
    categoria: item.categoria || null,
    valorBrutoCents: item.valor_bruto_cents || 0,
    descontoCents: item.desconto_cents || 0,
    acrescimoCents: item.acrescimo_cents || 0,
    taxaCartaoCents: item.taxa_cartao_cents || 0,
    custoProdutoCents: item.custo_produto_cents || 0,
    dataAtendimento: venda.data || new Date(),
    formaPagamento: venda.forma_pagamento || null,
    // estes serão preenchidos por profissional/papel no split
    profissionalId: null,
    papel: null,
    percentualParticipacao: 100,
  };
}

module.exports = {
  // pure functions
  calculate,
  calculateForItem,
  calculateForVenda,
  // sub-modules expostos
  RuleResolver,
  BaseExtractor,
  Calculator,
  SplitCalculator,
  AssistantCalculator,
  MetaCalculator,
  // persistence layer
  Repository,
};
