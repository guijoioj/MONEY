/**
 * BaseExtractor — extrai o valor base do cálculo conforme a regra.
 *
 * Pura. Sem side effects. Recebe contexto (cents integers) + base_calculo.
 *
 * @module services/CommissionEngine/BaseExtractor
 */

const { assertCents } = require('../../utils/money');

const BASES_VALIDAS = [
  'valor_bruto',
  'valor_com_desconto',
  'valor_liquido',
  'valor_liquido_sem_taxas',
  'lucro_bruto',
];

/**
 * @param {object} ctx
 * @param {number} ctx.valorBrutoCents
 * @param {number} [ctx.descontoCents=0]
 * @param {number} [ctx.acrescimoCents=0]
 * @param {number} [ctx.taxaCartaoCents=0]
 * @param {number} [ctx.custoProdutoCents=0]
 * @param {string} baseCalculo
 * @returns {number} valor base em centavos
 */
function extract(ctx, baseCalculo) {
  if (!BASES_VALIDAS.includes(baseCalculo)) {
    throw new RangeError(`BaseExtractor: base_calculo inválida "${baseCalculo}". Valores: ${BASES_VALIDAS.join(', ')}`);
  }

  const bruto = assertCents(ctx.valorBrutoCents ?? 0);
  const desc = assertCents(ctx.descontoCents ?? 0);
  const acr = assertCents(ctx.acrescimoCents ?? 0);
  const taxa = assertCents(ctx.taxaCartaoCents ?? 0);
  const custo = assertCents(ctx.custoProdutoCents ?? 0);

  switch (baseCalculo) {
    case 'valor_bruto':
      return bruto;
    case 'valor_com_desconto':
      return bruto - desc + acr;
    case 'valor_liquido':
      return bruto - desc + acr - taxa;
    case 'valor_liquido_sem_taxas':
      return bruto - desc + acr;
    case 'lucro_bruto':
      return bruto - custo;
    default:
      // unreachable mas defensivo
      throw new RangeError(`BaseExtractor: caso não tratado "${baseCalculo}"`);
  }
}

module.exports = { extract, BASES_VALIDAS };
