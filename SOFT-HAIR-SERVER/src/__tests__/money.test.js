/**
 * money.js unit tests.
 *
 * Cobertura crítica: arredondamento, edge cases, paridade BR/US, range overflow.
 */

const money = require('../utils/money');
const {
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
} = money;

describe('toCents', () => {
  test('integer reais → centavos', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(0)).toBe(0);
    expect(toCents(100)).toBe(10000);
  });

  test('decimal reais → centavos com round', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(0.99)).toBe(99);
  });

  test('float imprecision banker rounded', () => {
    // 0.1 + 0.2 === 0.30000000000000004 em JS
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  test('string US format', () => {
    expect(toCents('12.34')).toBe(1234);
    expect(toCents('0.05')).toBe(5);
  });

  test('string BR format (vírgula decimal)', () => {
    expect(toCents('12,34')).toBe(1234);
    expect(toCents('1.234,56')).toBe(123456); // milhar com ponto
  });

  test('string com R$ e espaços', () => {
    expect(toCents('R$ 10,50')).toBe(1050);
    expect(toCents(' R$1.234,56 ')).toBe(123456);
  });

  test('null/undefined/empty → 0', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents('')).toBe(0);
  });

  test('valores negativos', () => {
    expect(toCents(-10)).toBe(-1000);
    expect(toCents('-5,25')).toBe(-525);
  });

  test('rejeita NaN/Infinity', () => {
    expect(() => toCents(NaN)).toThrow(RangeError);
    expect(() => toCents(Infinity)).toThrow(RangeError);
    expect(() => toCents('abc')).toThrow(RangeError);
  });

  test('rejeita tipo não-suportado', () => {
    expect(() => toCents({})).toThrow(TypeError);
    expect(() => toCents([])).toThrow(TypeError);
  });

  test('bigint suportado', () => {
    expect(toCents(BigInt(1000))).toBe(1000);
  });
});

describe('fromCents', () => {
  test('centavos → reais', () => {
    expect(fromCents(1234)).toBe(12.34);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(1)).toBe(0.01);
  });

  test('rejeita float', () => {
    expect(() => fromCents(10.5)).toThrow(TypeError);
  });
});

describe('addCents', () => {
  test('soma simples', () => {
    expect(addCents(100, 200)).toBe(300);
    expect(addCents(0, 0)).toBe(0);
  });

  test('soma múltipla', () => {
    expect(addCents(100, 200, 300, 400)).toBe(1000);
  });

  test('soma com negativos', () => {
    expect(addCents(500, -200)).toBe(300);
  });

  test('rejeita floats', () => {
    expect(() => addCents(1.5, 2)).toThrow(TypeError);
  });
});

describe('subtractCents', () => {
  test('subtrai positivo', () => {
    expect(subtractCents(500, 200)).toBe(300);
  });

  test('resulta negativo', () => {
    expect(subtractCents(100, 250)).toBe(-150);
  });
});

describe('multiplyPercent', () => {
  test('30% de 100 reais', () => {
    expect(multiplyPercent(10000, 30)).toBe(3000);
  });

  test('100% retorna integral', () => {
    expect(multiplyPercent(12345, 100)).toBe(12345);
  });

  test('0% retorna 0', () => {
    expect(multiplyPercent(10000, 0)).toBe(0);
  });

  test('arredondamento meio-pra-cima', () => {
    // 333 * 33.3333 / 100 = 110.999889 → arredonda pra 111
    expect(multiplyPercent(333, 33.3333)).toBe(111);
  });

  test('aceita percentual em string', () => {
    expect(multiplyPercent(10000, '30')).toBe(3000);
    expect(multiplyPercent(10000, '30,5')).toBe(3050);
  });

  test('rejeita percent inválido', () => {
    expect(() => multiplyPercent(100, NaN)).toThrow(RangeError);
    expect(() => multiplyPercent(100, 'abc')).toThrow(RangeError);
  });
});

describe('assertCents', () => {
  test('aceita integer', () => {
    expect(assertCents(0)).toBe(0);
    expect(assertCents(1000)).toBe(1000);
    expect(assertCents(-1000)).toBe(-1000);
  });

  test('rejeita float', () => {
    expect(() => assertCents(1.5)).toThrow(TypeError);
  });

  test('rejeita NaN/Infinity', () => {
    expect(() => assertCents(NaN)).toThrow(RangeError);
    expect(() => assertCents(Infinity)).toThrow(RangeError);
  });

  test('rejeita não-number', () => {
    expect(() => assertCents('100')).toThrow(TypeError);
    expect(() => assertCents(null)).toThrow(TypeError);
  });

  test('rejeita overflow', () => {
    expect(() => assertCents(MAX_CENTS + 1)).toThrow(RangeError);
  });
});

describe('formatBRL', () => {
  test('formata positivo', () => {
    expect(formatBRL(123456)).toMatch(/R\$\s*1\.234,56/);
    expect(formatBRL(0)).toMatch(/R\$\s*0,00/);
    expect(formatBRL(100)).toMatch(/R\$\s*1,00/);
  });

  test('formata negativo', () => {
    expect(formatBRL(-1000)).toMatch(/-?R\$/);
  });
});

describe('sumValues', () => {
  test('soma valores mistos', () => {
    expect(sumValues([1.5, '2,50', '3.00', 4])).toBe(1100); // 150+250+300+400
  });

  test('vazio retorna 0', () => {
    expect(sumValues([])).toBe(0);
  });
});

describe('distribute', () => {
  test('split simples 50/50', () => {
    expect(distribute(100, [50, 50])).toEqual([50, 50]);
  });

  test('split 70/30', () => {
    expect(distribute(1000, [70, 30])).toEqual([700, 300]);
  });

  test('arredondamento joga residue na última parte', () => {
    // 100 cents / 3 pessoas iguais = 33.33 cada
    // Math.floor: [33, 33, 33] = 99 → residue 1 → última = 34
    expect(distribute(100, [1, 1, 1])).toEqual([33, 33, 34]);
  });

  test('soma das partes == total exato', () => {
    const parts = distribute(99999, [13, 27, 60]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(99999);
  });

  test('rejeita weights vazio', () => {
    expect(() => distribute(100, [])).toThrow(TypeError);
  });

  test('rejeita soma de weights <= 0', () => {
    expect(() => distribute(100, [0, 0])).toThrow(RangeError);
  });
});

describe('equalCents', () => {
  test('iguais exatos', () => {
    expect(equalCents(100, 100)).toBe(true);
    expect(equalCents(100, 101)).toBe(false);
  });

  test('com tolerância', () => {
    expect(equalCents(100, 101, 1)).toBe(true);
    expect(equalCents(100, 102, 1)).toBe(false);
    expect(equalCents(100, 99, 1)).toBe(true);
  });
});

describe('integração: pipeline real', () => {
  test('cálculo de comissão de 30% sobre R$ 250,75', () => {
    const valor = toCents('250,75');         // 25075
    const comissao = multiplyPercent(valor, 30); // 7522 (75.225 → 7523? round)
    // 25075 * 30 / 100 = 7522.5 → Math.round = 7523
    expect(comissao).toBe(7523);
    expect(formatBRL(comissao)).toMatch(/R\$\s*75,23/);
  });

  test('split 70/30 de R$ 100,00 dá 70 e 30 cravados', () => {
    const total = toCents(100);
    expect(distribute(total, [70, 30])).toEqual([7000, 3000]);
  });

  test('soma de pagamento bate com soma de comissões (reconciliação)', () => {
    const comissoes = [toCents(50), toCents(75.50), toCents(120.25)];
    const valorTotal = addCents(...comissoes);
    expect(valorTotal).toBe(24575);
    expect(equalCents(valorTotal, 24575)).toBe(true);
    // tolerância de 1¢ pra UI passar valor digitado pelo usuário
    expect(equalCents(valorTotal, 24574, 1)).toBe(true);
  });
});
