/**
 * money.js — utilitário financeiro centavos-safe.
 *
 * Regras de ouro:
 *   1. NUNCA use float pra cálculo financeiro.
 *   2. Internamente sempre trabalhe com INTEGER (centavos).
 *   3. Converter pra/de Number/string só na fronteira (input do user, output da UI).
 *   4. Comparação/soma/subtração: integer math, zero risco de arredondamento.
 *   5. Percentual: multiplicação inteira + Math.round() no final.
 *
 * Compatibilidade:
 *   - Campos DECIMAL(10,2) antigos podem ser convertidos via toCents(row.valor).
 *   - Novos campos *_cents armazenam diretamente o integer.
 *   - Coexistem durante migração: code novo lê *_cents primeiro, fallback pro DECIMAL.
 *
 * @module utils/money
 */

const MAX_CENTS = Number.MAX_SAFE_INTEGER; // 9_007_199_254_740_991 → ~R$ 90 trilhões
const MIN_CENTS = -MAX_CENTS;

/**
 * Converte um valor em reais (Number | string | DECIMAL do PG) para centavos integer.
 *
 *   toCents(10)        → 1000
 *   toCents(10.5)      → 1050
 *   toCents("12.34")   → 1234
 *   toCents("12,34")   → 1234   // aceita vírgula brasileira
 *   toCents(null)      → 0
 *   toCents(undefined) → 0
 *   toCents(0.1 + 0.2) → 30     // banker's rounding via Math.round
 *
 * @param {number|string|null|undefined} value
 * @returns {number} centavos integer
 * @throws {RangeError} se valor sair do MIN_CENTS/MAX_CENTS
 */
function toCents(value) {
  if (value === null || value === undefined || value === '') return 0;

  let num;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`toCents: valor inválido ${value}`);
    num = value;
  } else if (typeof value === 'string') {
    // Aceita "12,34" (BR), "12.34" (US), "1.234,56" (BR milhar+decimal).
    // Lógica: se tem vírgula, ela é decimal (BR); pontos viram separador de milhar.
    //         se só tem ponto, é decimal (US) — não toca.
    let clean = value.replace(/\s/g, '').replace(/R\$/i, '');
    if (clean.includes(',')) {
      // BR format: ponto é milhar, vírgula é decimal
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
    // se não tem vírgula, mantém ponto como decimal (US format) — sem mudança
    num = parseFloat(clean);
    if (!Number.isFinite(num)) throw new RangeError(`toCents: string inválida "${value}"`);
  } else if (typeof value === 'bigint') {
    return assertCents(Number(value));
  } else {
    throw new TypeError(`toCents: tipo não suportado ${typeof value}`);
  }

  // multiplica por 100 e arredonda pra evitar 10.1 → 1009.9999...
  const cents = Math.round(num * 100);
  return assertCents(cents);
}

/**
 * Converte centavos integer pra reais Number (com 2 casas decimais).
 *
 *   fromCents(1234) → 12.34
 *   fromCents(0)    → 0
 *
 * @param {number} cents
 * @returns {number}
 */
function fromCents(cents) {
  assertCents(cents);
  return cents / 100;
}

/**
 * Soma centavos. Integer math. Zero arredondamento.
 *   addCents(100, 250) → 350
 *
 * @param {...number} values
 * @returns {number}
 */
function addCents(...values) {
  let sum = 0;
  for (const v of values) {
    assertCents(v);
    sum += v;
  }
  return assertCents(sum);
}

/**
 * Subtrai b de a. Pode resultar negativo (válido pra ajustes/estornos).
 *   subtractCents(500, 200) → 300
 *   subtractCents(100, 250) → -150
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function subtractCents(a, b) {
  assertCents(a);
  assertCents(b);
  return assertCents(a - b);
}

/**
 * Multiplica centavos por percentual. Round-half-to-even (banker's) opcional;
 * por padrão usa Math.round que arredonda 0.5 pra cima.
 *
 *   multiplyPercent(10000, 30)     → 3000   // 30% de 100 reais
 *   multiplyPercent(10000, 30.5)   → 3050
 *   multiplyPercent(333, 33.3333)  → 111    // 333 * 33.3333 / 100 = 110.999...
 *
 * @param {number} cents
 * @param {number|string} percent  - número entre 0 e 100 (ou string que parseFloat parses)
 * @returns {number}
 */
function multiplyPercent(cents, percent) {
  assertCents(cents);
  const p = typeof percent === 'string' ? parseFloat(percent.replace(',', '.')) : percent;
  if (!Number.isFinite(p)) throw new RangeError(`multiplyPercent: percent inválido ${percent}`);
  // Calcula com precisão antes de arredondar
  const raw = (cents * p) / 100;
  return assertCents(Math.round(raw));
}

/**
 * Valida que valor é um integer no range seguro. Lança erro se não.
 *
 *   assertCents(100)    → 100
 *   assertCents(10.5)   → throw (não é integer)
 *   assertCents(NaN)    → throw
 *
 * @param {number} cents
 * @returns {number} o mesmo valor (pra chaining)
 * @throws {TypeError|RangeError}
 */
function assertCents(cents) {
  if (typeof cents !== 'number') {
    throw new TypeError(`assertCents: esperado number, recebeu ${typeof cents}`);
  }
  if (!Number.isFinite(cents)) {
    throw new RangeError(`assertCents: valor não finito ${cents}`);
  }
  if (!Number.isInteger(cents)) {
    throw new TypeError(`assertCents: esperado integer, recebeu ${cents}`);
  }
  if (cents > MAX_CENTS || cents < MIN_CENTS) {
    throw new RangeError(`assertCents: fora do range seguro: ${cents}`);
  }
  return cents;
}

/**
 * Formata centavos como BRL.
 *
 *   formatBRL(123456)  → "R$ 1.234,56"
 *   formatBRL(0)       → "R$ 0,00"
 *   formatBRL(-1000)   → "-R$ 10,00"
 *
 * @param {number} cents
 * @returns {string}
 */
function formatBRL(cents) {
  assertCents(cents);
  // Usa Intl.NumberFormat pt-BR
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Soma valores monetários que podem estar misturados (Number, string, DECIMAL).
 * Útil quando recebe linha do banco com campos legacy DECIMAL.
 *
 *   sumValues([1.5, "2,50", "3.00", 4]) → 1100 cents
 *
 * @param {Array<number|string>} values
 * @returns {number} cents
 */
function sumValues(values) {
  return values.reduce((acc, v) => acc + toCents(v), 0);
}

/**
 * Distribui um total em partes proporcionais com correção de arredondamento.
 * Útil pra split de comissão: garante que soma das partes = total exato.
 *
 *   distribute(100, [50, 50])           → [50, 50]
 *   distribute(100, [33.33, 33.33, 33.34]) → [33, 33, 34]   // resíduo na última
 *   distribute(1000, [70, 30])          → [700, 300]
 *
 * @param {number} totalCents
 * @param {Array<number>} weights  - pesos percentuais (somam 100 idealmente)
 * @returns {Array<number>}
 */
function distribute(totalCents, weights) {
  assertCents(totalCents);
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new TypeError('distribute: weights deve ser array não-vazio');
  }
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) throw new RangeError('distribute: soma de weights deve ser > 0');

  const parts = weights.map(w => Math.floor((totalCents * w) / totalWeight));
  const distributed = parts.reduce((s, p) => s + p, 0);
  const residue = totalCents - distributed;
  // joga residue na última parte pra garantir soma exata
  if (residue !== 0) parts[parts.length - 1] += residue;
  return parts.map(assertCents);
}

/**
 * Compara dois valores em centavos com tolerância opcional (default 0).
 * Útil pra reconciliação de pagamento.
 *
 *   equalCents(100, 100)        → true
 *   equalCents(100, 101)        → false
 *   equalCents(100, 101, 1)     → true   (tolerância 1 centavo)
 *
 * @param {number} a
 * @param {number} b
 * @param {number} tolerance default 0
 * @returns {boolean}
 */
function equalCents(a, b, tolerance = 0) {
  assertCents(a);
  assertCents(b);
  assertCents(tolerance);
  return Math.abs(a - b) <= tolerance;
}

module.exports = {
  toCents,
  fromCents,
  addCents,
  subtractCents,
  multiplyPercent,
  assertCents,
  formatBRL,
  sumValues,
  distribute,
  equalCents,
  MAX_CENTS,
  MIN_CENTS,
};
