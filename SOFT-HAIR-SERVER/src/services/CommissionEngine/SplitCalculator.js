/**
 * SplitCalculator — divide comissão entre múltiplos profissionais.
 *
 * Pura.
 *
 * @module services/CommissionEngine/SplitCalculator
 */

const { distribute, assertCents } = require('../../utils/money');
const RuleResolver = require('./RuleResolver');
const BaseExtractor = require('./BaseExtractor');
const Calculator = require('./Calculator');

/**
 * Calcula split entre profissionais (todos 'principal' ou 'split').
 * Soma de percentual_participacao deve ser 100 (±0.01 tolerância).
 *
 * @param {object} itemCtx  - contexto comum do item (sem profissionalId)
 * @param {Array<{id, papel?, percentual_participacao}>} profissionais
 * @param {Array<object>} regrasDisponiveis
 * @returns {Array<object>}  - 1 entry por profissional com calc completo
 */
function calculateSplit(itemCtx, profissionais, regrasDisponiveis) {
  if (!Array.isArray(profissionais) || profissionais.length === 0) {
    throw new TypeError('SplitCalculator: profissionais deve ser array não-vazio');
  }

  const totalParticipacao = profissionais.reduce(
    (s, p) => s + (Number(p.percentual_participacao) || 0), 0
  );
  if (Math.abs(totalParticipacao - 100) > 0.01) {
    throw new RangeError(
      `SplitCalculator: soma percentual_participacao deve ser 100, recebeu ${totalParticipacao}`
    );
  }

  // Resolve regra base (ignora profissionalId pra escolher 1 regra pra todos)
  // Mas se houver regras profissional_servico específicas, cada prof pode ter regra diferente.
  // Implementação: resolver regra POR profissional.
  const resultados = profissionais.map(p => {
    const ctxProf = {
      ...itemCtx,
      profissionalId: p.id,
      papel: p.papel || (profissionais.length === 1 ? 'principal' : 'split'),
    };
    const regra = RuleResolver.resolve(ctxProf, regrasDisponiveis);
    if (!regra) {
      return {
        profissionalId: p.id,
        papel: ctxProf.papel,
        percentualParticipacao: p.percentual_participacao,
        valorBaseCents: 0,
        valorComissaoCents: 0,
        regra: null,
        regraSnapshot: null,
        baseCalculo: null,
        percentual: null,
        valorFixoCents: null,
        trace: 'no_rule_matched',
      };
    }

    const valorBaseCents = BaseExtractor.extract(ctxProf, regra.base_calculo);
    const comissaoIntegral = Calculator.calculate(valorBaseCents, regra);
    // Aplica participacao do split sobre o valor final
    const comissaoFinal = Calculator.applyParticipation(
      comissaoIntegral, p.percentual_participacao
    );

    return {
      profissionalId: p.id,
      papel: ctxProf.papel,
      percentualParticipacao: p.percentual_participacao,
      valorBaseCents,
      valorComissaoCents: comissaoFinal,
      regraId: regra.id,
      regra,
      regraSnapshot: snapshotRegra(regra),
      baseCalculo: regra.base_calculo,
      percentual: regra.percentual,
      valorFixoCents: regra.valor_fixo_cents,
      trace: 'split_applied',
    };
  });

  return resultados;
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

module.exports = { calculateSplit, snapshotRegra };
