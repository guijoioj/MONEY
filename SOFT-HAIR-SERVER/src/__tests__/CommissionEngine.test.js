/**
 * CommissionEngine — testes unitários puros (sem DB).
 */

const Engine = require('../services/CommissionEngine');
const { calculate, calculateForItem, calculateForVenda, RuleResolver, BaseExtractor, Calculator, SplitCalculator, AssistantCalculator, MetaCalculator } = Engine;

// helpers
function regra(id, tipo, props = {}) {
  return {
    id,
    salao_id: 1,
    nome: `regra-${id}`,
    tipo,
    base_calculo: 'valor_bruto',
    ativo: true,
    data_inicio: '2026-01-01',
    data_fim: null,
    prioridade: 0,
    condicoes_json: {},
    profissional_id: null,
    servico_id: null,
    produto_id: null,
    categoria: null,
    percentual: null,
    valor_fixo_cents: null,
    ...props,
  };
}

const ctxBase = {
  salaoId: 1,
  profissionalId: 10,
  papel: 'principal',
  servicoId: 100,
  produtoId: null,
  categoria: null,
  tipoItem: 'servico',
  valorBrutoCents: 10000,  // R$ 100
  descontoCents: 0,
  acrescimoCents: 0,
  taxaCartaoCents: 0,
  custoProdutoCents: 0,
  dataAtendimento: new Date('2026-05-15T14:00:00Z'),
  formaPagamento: 'dinheiro',
  percentualParticipacao: 100,
};

// ==========================================================================
// BaseExtractor
// ==========================================================================
describe('BaseExtractor', () => {
  test('valor_bruto retorna bruto', () => {
    expect(BaseExtractor.extract({ valorBrutoCents: 10000 }, 'valor_bruto')).toBe(10000);
  });

  test('valor_com_desconto = bruto - desconto + acréscimo', () => {
    expect(BaseExtractor.extract({
      valorBrutoCents: 10000, descontoCents: 1000, acrescimoCents: 500,
    }, 'valor_com_desconto')).toBe(9500);
  });

  test('valor_liquido subtrai taxa de cartão', () => {
    expect(BaseExtractor.extract({
      valorBrutoCents: 10000, descontoCents: 1000, taxaCartaoCents: 300,
    }, 'valor_liquido')).toBe(8700);
  });

  test('lucro_bruto = bruto - custo', () => {
    expect(BaseExtractor.extract({
      valorBrutoCents: 5000, custoProdutoCents: 2000,
    }, 'lucro_bruto')).toBe(3000);
  });

  test('base inválida lança', () => {
    expect(() => BaseExtractor.extract({ valorBrutoCents: 100 }, 'xyz')).toThrow(RangeError);
  });
});

// ==========================================================================
// Calculator
// ==========================================================================
describe('Calculator', () => {
  test('percentual de valor base', () => {
    expect(Calculator.calculate(10000, { percentual: 30 })).toBe(3000);
  });

  test('valor fixo ignora base', () => {
    expect(Calculator.calculate(99999, { valor_fixo_cents: 2500 })).toBe(2500);
  });

  test('regra sem percentual nem fixo lança', () => {
    expect(() => Calculator.calculate(10000, {})).toThrow();
  });

  test('participação 100% mantém', () => {
    expect(Calculator.applyParticipation(1000, 100)).toBe(1000);
  });

  test('participação 70% reduz', () => {
    expect(Calculator.applyParticipation(1000, 70)).toBe(700);
  });
});

// ==========================================================================
// RuleResolver
// ==========================================================================
describe('RuleResolver — hierarquia', () => {
  const rGlobal = regra(1, 'global', { percentual: 10 });
  const rProf = regra(2, 'profissional', { percentual: 20, profissional_id: 10 });
  const rServ = regra(3, 'servico', { percentual: 30, servico_id: 100 });
  const rProfServ = regra(4, 'profissional_servico', { percentual: 40, profissional_id: 10, servico_id: 100 });
  const rOutroProf = regra(5, 'profissional', { percentual: 99, profissional_id: 999 });
  const rOutroSalao = regra(6, 'global', { percentual: 50, salao_id: 2 });

  test('profissional_servico vence todos', () => {
    const r = RuleResolver.resolve(ctxBase, [rGlobal, rProf, rServ, rProfServ, rOutroProf]);
    expect(r.id).toBe(4);
    expect(r.percentual).toBe(40);
  });

  test('servico vence profissional', () => {
    const r = RuleResolver.resolve(ctxBase, [rGlobal, rProf, rServ]);
    expect(r.id).toBe(3);
  });

  test('profissional vence global', () => {
    const r = RuleResolver.resolve(ctxBase, [rGlobal, rProf]);
    expect(r.id).toBe(2);
  });

  test('só global se nada bate', () => {
    const r = RuleResolver.resolve(ctxBase, [rGlobal]);
    expect(r.id).toBe(1);
  });

  test('regra de outro salão ignorada', () => {
    const r = RuleResolver.resolve(ctxBase, [rOutroSalao]);
    expect(r).toBeNull();
  });

  test('regra de outro profissional ignorada', () => {
    const r = RuleResolver.resolve(ctxBase, [rOutroProf]);
    expect(r).toBeNull();
  });

  test('regra inativa ignorada', () => {
    const r = RuleResolver.resolve(ctxBase, [{ ...rGlobal, ativo: false }]);
    expect(r).toBeNull();
  });

  test('regra fora de vigência ignorada', () => {
    const expirada = { ...rGlobal, data_fim: '2026-01-31' };
    const r = RuleResolver.resolve({ ...ctxBase, dataAtendimento: new Date('2026-05-15') }, [expirada]);
    expect(r).toBeNull();
  });
});

describe('RuleResolver — condições JSON', () => {
  test('dias_semana: quinta-feira (4) só ativa em [4,5]', () => {
    const r = regra(1, 'global', { percentual: 30, condicoes_json: { dias_semana: [4, 5] } });
    const sexta = new Date('2026-05-15T14:00:00');  // 15/5/2026 era sexta
    const quarta = new Date('2026-05-13T14:00:00');  // 13/5 era quarta
    expect(RuleResolver.resolve({ ...ctxBase, dataAtendimento: sexta }, [r])).not.toBeNull();
    expect(RuleResolver.resolve({ ...ctxBase, dataAtendimento: quarta }, [r])).toBeNull();
  });

  test('forma_pagamento: só dinheiro/pix', () => {
    const r = regra(1, 'global', { percentual: 30, condicoes_json: { formas_pagamento: ['dinheiro', 'pix'] } });
    expect(RuleResolver.resolve({ ...ctxBase, formaPagamento: 'dinheiro' }, [r])).not.toBeNull();
    expect(RuleResolver.resolve({ ...ctxBase, formaPagamento: 'cartao' }, [r])).toBeNull();
  });

  test('valor_minimo: bloqueia abaixo', () => {
    const r = regra(1, 'global', { percentual: 30, condicoes_json: { valor_minimo_cents: 5000 } });
    expect(RuleResolver.resolve({ ...ctxBase, valorBrutoCents: 10000 }, [r])).not.toBeNull();
    expect(RuleResolver.resolve({ ...ctxBase, valorBrutoCents: 3000 }, [r])).toBeNull();
  });

  test('papel: assistente não pega regra de principal', () => {
    const r = regra(1, 'global', { percentual: 30 });
    expect(RuleResolver.resolve({ ...ctxBase, papel: 'assistente' }, [r])).toBeNull();
  });

  test('regra assistente bate', () => {
    const r = regra(1, 'assistente', { percentual: 10 });
    expect(RuleResolver.resolve({ ...ctxBase, papel: 'assistente' }, [r])).not.toBeNull();
  });
});

// ==========================================================================
// Engine.calculate (1 comissão simples)
// ==========================================================================
describe('calculate', () => {
  test('regra básica: 30% de 100 reais = 30 reais', () => {
    const r = [regra(1, 'profissional', { percentual: 30, profissional_id: 10 })];
    const result = calculate(ctxBase, r);
    expect(result.valorBaseCents).toBe(10000);
    expect(result.valorComissaoCents).toBe(3000);
    expect(result.percentual).toBe(30);
    expect(result.regraId).toBe(1);
  });

  test('snapshot de regra incluso', () => {
    const r = [regra(1, 'profissional', { percentual: 30, profissional_id: 10 })];
    const result = calculate(ctxBase, r);
    expect(result.regraSnapshot.tipo).toBe('profissional');
    expect(result.regraSnapshot.percentual).toBe(30);
    expect(result.regraSnapshot.snapshot_at).toBeDefined();
  });

  test('sem regra: retorna zero com trace', () => {
    const result = calculate(ctxBase, []);
    expect(result.valorComissaoCents).toBe(0);
    expect(result.regraId).toBeNull();
    expect(result.trace).toBe('no_rule_matched');
  });

  test('valor fixo: ignora base', () => {
    const r = [regra(1, 'profissional', { valor_fixo_cents: 2500, profissional_id: 10 })];
    const result = calculate(ctxBase, r);
    expect(result.valorComissaoCents).toBe(2500);
  });

  test('participação 70%: aplica sobre cálculo', () => {
    const r = [regra(1, 'profissional', { percentual: 30, profissional_id: 10 })];
    const result = calculate({ ...ctxBase, percentualParticipacao: 70 }, r);
    expect(result.valorComissaoCents).toBe(2100);  // 3000 * 70%
  });

  test('base lucro_bruto para produto', () => {
    const r = [regra(1, 'produto', { percentual: 20, produto_id: 200, base_calculo: 'lucro_bruto' })];
    const result = calculate({
      ...ctxBase,
      tipoItem: 'produto',
      servicoId: null,
      produtoId: 200,
      valorBrutoCents: 5000,
      custoProdutoCents: 2000,
    }, r);
    expect(result.valorBaseCents).toBe(3000);
    expect(result.valorComissaoCents).toBe(600);  // 20% de 3000
  });
});

// ==========================================================================
// SplitCalculator
// ==========================================================================
describe('SplitCalculator', () => {
  test('split 70/30 entre 2 profissionais', () => {
    const r = [regra(1, 'global', { percentual: 40 })];
    const resultados = SplitCalculator.calculateSplit(
      { ...ctxBase, profissionalId: null },
      [
        { id: 10, percentual_participacao: 70 },
        { id: 20, percentual_participacao: 30 },
      ],
      r
    );
    expect(resultados).toHaveLength(2);
    // base = 10000, comissão integral = 4000
    // 10: 70% → 2800; 20: 30% → 1200
    expect(resultados[0].valorComissaoCents).toBe(2800);
    expect(resultados[1].valorComissaoCents).toBe(1200);
    expect(resultados[0].percentualParticipacao).toBe(70);
  });

  test('split soma != 100 → erro', () => {
    const r = [regra(1, 'global', { percentual: 40 })];
    expect(() => SplitCalculator.calculateSplit(
      { ...ctxBase, profissionalId: null },
      [{ id: 10, percentual_participacao: 70 }, { id: 20, percentual_participacao: 40 }],
      r
    )).toThrow(RangeError);
  });

  test('3 profissionais 33/33/34', () => {
    const r = [regra(1, 'global', { percentual: 30 })];
    const resultados = SplitCalculator.calculateSplit(
      { ...ctxBase, profissionalId: null },
      [
        { id: 1, percentual_participacao: 33 },
        { id: 2, percentual_participacao: 33 },
        { id: 3, percentual_participacao: 34 },
      ],
      r
    );
    // base = 10000, integral = 3000; 33%=990, 33%=990, 34%=1020
    // soma 990+990+1020 = 3000 ✓
    expect(resultados[0].valorComissaoCents).toBe(990);
    expect(resultados[2].valorComissaoCents).toBe(1020);
  });
});

// ==========================================================================
// AssistantCalculator
// ==========================================================================
describe('AssistantCalculator', () => {
  test('% sobre valor_servico', () => {
    const r = [regra(1, 'assistente', { percentual: 10, base_calculo: 'valor_bruto' })];
    const principal = { valorComissaoCents: 3000 };
    const result = AssistantCalculator.calculateAssistant(
      ctxBase, [{ id: 99 }], principal, r
    );
    expect(result).toHaveLength(1);
    expect(result[0].valorBaseCents).toBe(10000);
    expect(result[0].valorComissaoCents).toBe(1000);  // 10% de 10000
    expect(result[0].papel).toBe('assistente');
  });

  test('% sobre comissao_principal', () => {
    const r = [regra(1, 'assistente', {
      percentual: 20,
      base_calculo: 'valor_bruto',
      condicoes_json: { calcular_sobre: 'comissao_principal' },
    })];
    const principal = { valorComissaoCents: 3000 };
    const result = AssistantCalculator.calculateAssistant(
      ctxBase, [{ id: 99 }], principal, r
    );
    expect(result[0].valorBaseCents).toBe(3000);
    expect(result[0].valorComissaoCents).toBe(600);  // 20% de 3000
  });

  test('valor fixo', () => {
    const r = [regra(1, 'assistente', {
      valor_fixo_cents: 500,
      condicoes_json: { calcular_sobre: 'valor_fixo' },
    })];
    const result = AssistantCalculator.calculateAssistant(
      ctxBase, [{ id: 99 }], null, r
    );
    expect(result[0].valorComissaoCents).toBe(500);
  });

  test('sem assistentes retorna vazio', () => {
    const r = [];
    const result = AssistantCalculator.calculateAssistant(ctxBase, [], null, r);
    expect(result).toEqual([]);
  });

  test('sem regra de assistente filtra null', () => {
    const r = [regra(1, 'global', { percentual: 30 })];
    const result = AssistantCalculator.calculateAssistant(
      ctxBase, [{ id: 99 }], { valorComissaoCents: 3000 }, r
    );
    expect(result).toEqual([]);
  });
});

// ==========================================================================
// MetaCalculator
// ==========================================================================
describe('MetaCalculator', () => {
  const faixasProgressivo = [
    { ordem: 1, faixa_inicio_cents: 0,       faixa_fim_cents: 500000, percentual: 30, modo: 'progressivo' },
    { ordem: 2, faixa_inicio_cents: 500000,  faixa_fim_cents: 1000000, percentual: 35, modo: 'progressivo' },
    { ordem: 3, faixa_inicio_cents: 1000000, faixa_fim_cents: null,    percentual: 40, modo: 'progressivo' },
  ];

  test('progressivo: 7000 reais acumulado', () => {
    // 5000 a 30% = 1500
    // 2000 a 35% = 700
    // total = 2200 reais = 220000 cents
    const total = MetaCalculator.calcularProgressivo(700000, faixasProgressivo);
    expect(total).toBe(220000);
  });

  test('progressivo: bateu última faixa', () => {
    // 15000: 5000*30 + 5000*35 + 5000*40 = 1500 + 1750 + 2000 = 5250 reais
    const total = MetaCalculator.calcularProgressivo(1500000, faixasProgressivo);
    expect(total).toBe(525000);
  });

  test('progressivo: zero acumulado', () => {
    expect(MetaCalculator.calcularProgressivo(0, faixasProgressivo)).toBe(0);
  });

  test('retroativo: bateu meta 10000 → 40% de tudo', () => {
    const { comissaoTotalCents, faixaAtual } = MetaCalculator.calcularRetroativo(1050000, faixasProgressivo);
    // 10500 * 40% = 4200 reais = 420000 cents
    expect(comissaoTotalCents).toBe(420000);
    expect(faixaAtual.percentual).toBe(40);
  });

  test('findFaixa: meio do range', () => {
    const f = MetaCalculator.findFaixa(750000, faixasProgressivo);
    expect(f.ordem).toBe(2);
    expect(f.percentual).toBe(35);
  });

  test('findFaixa: acima da última', () => {
    const f = MetaCalculator.findFaixa(99999999, faixasProgressivo);
    expect(f.ordem).toBe(3);
  });

  test('calcularDeltaAjuste: bônus positivo', () => {
    // esperado 4200 reais, pagou 3000 reais → ajuste +1200
    expect(MetaCalculator.calcularDeltaAjuste(420000, 300000)).toBe(120000);
  });
});

// ==========================================================================
// calculateForItem / calculateForVenda
// ==========================================================================
describe('calculateForItem', () => {
  test('1 principal + 1 assistente', () => {
    const regras = [
      regra(1, 'profissional', { percentual: 30, profissional_id: 10 }),
      regra(2, 'assistente', { percentual: 10, base_calculo: 'valor_bruto' }),
    ];
    const result = calculateForItem(
      ctxBase,
      [{ id: 10, percentual_participacao: 100 }],
      [{ id: 99 }],
      regras
    );
    expect(result).toHaveLength(2);
    // principal: 30% de 10000 = 3000
    expect(result[0].valorComissaoCents).toBe(3000);
    expect(result[0].papel).toBe('principal');
    // assistente: 10% de 10000 = 1000
    expect(result[1].valorComissaoCents).toBe(1000);
    expect(result[1].papel).toBe('assistente');
  });

  test('split + assistente', () => {
    const regras = [
      regra(1, 'global', { percentual: 40 }),
      regra(2, 'assistente', { percentual: 10, base_calculo: 'valor_bruto' }),
    ];
    const result = calculateForItem(
      ctxBase,
      [
        { id: 10, percentual_participacao: 70 },
        { id: 20, percentual_participacao: 30 },
      ],
      [{ id: 99 }],
      regras
    );
    expect(result).toHaveLength(3);
    // split: 4000 → 2800 + 1200
    expect(result[0].valorComissaoCents).toBe(2800);
    expect(result[1].valorComissaoCents).toBe(1200);
    // assistente
    expect(result[2].valorComissaoCents).toBe(1000);
  });
});

describe('calculateForVenda', () => {
  test('venda com 2 itens, cada um c/ 1 prof', () => {
    const venda = {
      id: 1, salao_id: 1, cliente_id: 5, data: '2026-05-15T14:00:00Z',
      forma_pagamento: 'pix',
      itens: [
        {
          id: 100, tipo_item: 'servico', servico_id: 50,
          valor_bruto_cents: 10000, desconto_cents: 0,
          profissionais: [{ id: 10, percentual_participacao: 100 }],
          assistentes: [],
        },
        {
          id: 101, tipo_item: 'produto', produto_id: 200,
          valor_bruto_cents: 5000, custo_produto_cents: 2000,
          profissionais: [{ id: 20, percentual_participacao: 100 }],
          assistentes: [],
        },
      ],
    };
    const regras = [
      regra(1, 'global', { percentual: 30 }),
    ];
    const result = calculateForVenda(venda, regras);
    expect(result).toHaveLength(2);
    expect(result[0].valorComissaoCents).toBe(3000); // 30% de 10000
    expect(result[1].valorComissaoCents).toBe(1500); // 30% de 5000
    expect(result[0].itemContext.itemVendaId).toBe(100);
    expect(result[1].itemContext.itemVendaId).toBe(101);
  });

  test('venda sem itens retorna vazio', () => {
    expect(calculateForVenda({ id: 1, itens: [] }, [])).toEqual([]);
  });
});

// ==========================================================================
// Integração: cenários reais
// ==========================================================================
describe('integração: cenários reais', () => {
  test('cenário Avec: 30% padrão profissional + serviço com 40% específico', () => {
    const regras = [
      regra(1, 'global', { percentual: 20 }),
      regra(2, 'profissional', { percentual: 30, profissional_id: 10 }),
      regra(3, 'servico', { percentual: 40, servico_id: 100 }),
    ];
    const result = calculate(ctxBase, regras);
    expect(result.regraId).toBe(3);  // servico vence
    expect(result.valorComissaoCents).toBe(4000);
  });

  test('cenário promocional: 50% nas terças à noite', () => {
    const regras = [
      regra(1, 'profissional', { percentual: 30, profissional_id: 10 }),
      regra(2, 'horario', {
        percentual: 50,
        prioridade: 100,  // força prioridade
        condicoes_json: {
          dias_semana: [2], // terça
          hora_inicio: '18:00',
          hora_fim: '23:00',
        },
      }),
    ];
    const tercaNoite = new Date('2026-05-12T19:00:00');  // 12/5/26 era terça
    const result = calculate({ ...ctxBase, dataAtendimento: tercaNoite }, regras);
    expect(result.regraId).toBe(2);
    expect(result.valorComissaoCents).toBe(5000);
  });

  test('cenário pagamento: cliente pagou cartão → desconta taxa', () => {
    const regras = [
      regra(1, 'global', { percentual: 30, base_calculo: 'valor_liquido' }),
    ];
    const result = calculate({
      ...ctxBase,
      taxaCartaoCents: 500,  // R$5 de taxa
      formaPagamento: 'cartao',
    }, regras);
    expect(result.valorBaseCents).toBe(9500);  // 10000 - 500
    expect(result.valorComissaoCents).toBe(2850);  // 30%
  });
});
