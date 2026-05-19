/**
 * MetaCalculator — aplica metas escalonadas (progressivo ou retroativo).
 *
 *   Progressivo: cada faixa aplica só no trecho dentro dela
 *     ex: até 5000=30%, 5000-10000=35%, 10000+=40%
 *     vendeu 7000 → 5000*30% + 2000*35% = 1500 + 700 = 2200
 *
 *   Retroativo: ao bater faixa, todo o período recalcula com novo %
 *     ex: mesma tabela, vendeu 10500 (passou meta) → 10500*40% = 4200
 *     gera AJUSTE positivo (diff entre 40% e o que já foi pago)
 *
 * @module services/CommissionEngine/MetaCalculator
 */

const { multiplyPercent, addCents, subtractCents, assertCents } = require('../../utils/money');

/**
 * Encontra a faixa aplicável ao valor acumulado.
 *
 * @param {number} acumulado  - cents (ou unidade conforme tipo_base)
 * @param {Array<object>} faixas  - ordenadas por `ordem`
 * @returns {object|null}
 */
function findFaixa(acumulado, faixas) {
  if (!Array.isArray(faixas) || faixas.length === 0) return null;
  // Ordena por ordem crescente (defensivo)
  const ordenadas = [...faixas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  for (const f of ordenadas) {
    const inicio = f.faixa_inicio_cents ?? 0;
    const fim = f.faixa_fim_cents; // null = infinito
    if (acumulado >= inicio && (fim == null || acumulado < fim)) {
      return f;
    }
  }
  return null;
}

/**
 * Calcula comissão progressiva sobre acumulado.
 *
 * @param {number} acumuladoCents
 * @param {Array<object>} faixas
 * @returns {number} total de comissão em cents
 */
function calcularProgressivo(acumuladoCents, faixas) {
  assertCents(acumuladoCents);
  if (acumuladoCents <= 0) return 0;

  const ordenadas = [...faixas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  let total = 0;
  let restante = acumuladoCents;

  for (const f of ordenadas) {
    const inicio = f.faixa_inicio_cents ?? 0;
    const fim = f.faixa_fim_cents; // null = infinito
    if (acumuladoCents < inicio) break;

    const limiteFaixa = fim == null ? acumuladoCents : Math.min(fim, acumuladoCents);
    const trecho = limiteFaixa - inicio;
    if (trecho <= 0) continue;

    const contribuicao = multiplyPercent(trecho, Number(f.percentual));
    total = addCents(total, contribuicao);

    if (fim == null || acumuladoCents <= fim) break;
  }

  return total;
}

/**
 * Calcula comissão retroativa: faixa atual × acumulado inteiro.
 *
 * @param {number} acumuladoCents
 * @param {Array<object>} faixas
 * @returns {{comissaoTotalCents: number, faixaAtual: object|null}}
 */
function calcularRetroativo(acumuladoCents, faixas) {
  assertCents(acumuladoCents);
  const faixa = findFaixa(acumuladoCents, faixas);
  if (!faixa) {
    return { comissaoTotalCents: 0, faixaAtual: null };
  }
  const total = multiplyPercent(acumuladoCents, Number(faixa.percentual));
  return { comissaoTotalCents: total, faixaAtual: faixa };
}

/**
 * Compara comissão esperada (pela meta) vs já paga, retorna ajuste necessário.
 * Positivo: precisa pagar mais (bônus retroativo).
 * Negativo: pagou demais (raro, mas possível em recálculo).
 *
 * @param {number} comissaoEsperadaCents
 * @param {number} comissaoJaPagaCents
 * @returns {number} delta em cents (pode ser negativo)
 */
function calcularDeltaAjuste(comissaoEsperadaCents, comissaoJaPagaCents) {
  return subtractCents(comissaoEsperadaCents, comissaoJaPagaCents);
}

module.exports = {
  findFaixa,
  calcularProgressivo,
  calcularRetroativo,
  calcularDeltaAjuste,
};
