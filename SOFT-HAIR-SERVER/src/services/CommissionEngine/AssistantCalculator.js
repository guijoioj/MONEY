/**
 * AssistantCalculator — calcula comissão de assistentes.
 *
 * Regra `tipo='assistente'` com `condicoes_json.calcular_sobre`:
 *   - `valor_servico` (default): % sobre base do serviço/produto
 *   - `comissao_principal`: % sobre o que o principal recebeu
 *   - `valor_fixo`: valor_fixo_cents direto
 *
 * @module services/CommissionEngine/AssistantCalculator
 */

const { multiplyPercent, assertCents } = require('../../utils/money');
const RuleResolver = require('./RuleResolver');
const BaseExtractor = require('./BaseExtractor');
const Calculator = require('./Calculator');
const { snapshotRegra } = require('./SplitCalculator');

/**
 * @param {object} itemCtx  - contexto do item
 * @param {Array<{id}>} assistentes
 * @param {object|null} comissaoPrincipal  - resultado do principal { valorComissaoCents, ... }
 * @param {Array<object>} regras
 * @returns {Array<object>}
 */
function calculateAssistant(itemCtx, assistentes, comissaoPrincipal, regras) {
  if (!Array.isArray(assistentes) || assistentes.length === 0) return [];

  return assistentes.map(asst => {
    const ctxAsst = {
      ...itemCtx,
      profissionalId: asst.id,
      papel: 'assistente',
    };
    const regra = RuleResolver.resolve(ctxAsst, regras);
    if (!regra) return null;

    const calcularSobre = regra.condicoes_json?.calcular_sobre || 'valor_servico';

    if (calcularSobre === 'valor_fixo' && regra.valor_fixo_cents != null) {
      return buildResult({
        ctxAsst,
        valorBaseCents: 0,
        valorComissaoCents: assertCents(regra.valor_fixo_cents),
        regra,
        trace: 'assistente_valor_fixo',
      });
    }

    let valorBaseCents;
    if (calcularSobre === 'comissao_principal') {
      if (!comissaoPrincipal) {
        // sem principal, assistente não calcula
        return null;
      }
      valorBaseCents = comissaoPrincipal.valorComissaoCents;
    } else {
      // valor_servico
      valorBaseCents = BaseExtractor.extract(ctxAsst, regra.base_calculo);
    }

    const valorComissaoCents = Calculator.calculate(valorBaseCents, regra);

    return buildResult({
      ctxAsst,
      valorBaseCents,
      valorComissaoCents,
      regra,
      trace: `assistente_${calcularSobre}`,
    });
  }).filter(Boolean);
}

function buildResult({ ctxAsst, valorBaseCents, valorComissaoCents, regra, trace }) {
  return {
    profissionalId: ctxAsst.profissionalId,
    papel: 'assistente',
    percentualParticipacao: 100,
    valorBaseCents,
    valorComissaoCents,
    regraId: regra.id,
    regra,
    regraSnapshot: snapshotRegra(regra),
    baseCalculo: regra.base_calculo,
    percentual: regra.percentual,
    valorFixoCents: regra.valor_fixo_cents,
    trace,
  };
}

module.exports = { calculateAssistant };
