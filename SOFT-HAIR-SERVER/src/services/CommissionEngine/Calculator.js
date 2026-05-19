/**
 * Calculator — aplica regra a valor base e retorna comissão em centavos.
 *
 * Pura. Sem side effects.
 *
 * @module services/CommissionEngine/Calculator
 */

const { multiplyPercent, assertCents } = require('../../utils/money');

/**
 * @param {number} valorBaseCents
 * @param {object} regra  - linha de regras_comissao
 * @param {number} regra.percentual  - NUMERIC(7,4): 30.0000 = 30%
 * @param {number} regra.valor_fixo_cents
 * @returns {number} comissão em centavos
 */
function calculate(valorBaseCents, regra) {
  assertCents(valorBaseCents);

  if (regra.valor_fixo_cents != null) {
    return assertCents(regra.valor_fixo_cents);
  }

  if (regra.percentual != null) {
    const p = Number(regra.percentual); // pg retorna NUMERIC como string em alguns casos
    return multiplyPercent(valorBaseCents, p);
  }

  throw new Error('Calculator: regra precisa ter percentual OU valor_fixo_cents');
}

/**
 * Aplica participação (split) sobre o valor de comissão.
 * 70% de participação em comissão de 1000 cents = 700 cents.
 *
 * @param {number} comissaoCents
 * @param {number} percentualParticipacao  - 0-100
 * @returns {number}
 */
function applyParticipation(comissaoCents, percentualParticipacao) {
  assertCents(comissaoCents);
  if (percentualParticipacao === 100) return comissaoCents;
  return multiplyPercent(comissaoCents, percentualParticipacao);
}

module.exports = { calculate, applyParticipation };
