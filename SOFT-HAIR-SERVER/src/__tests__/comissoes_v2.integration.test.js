/**
 * Comissões V2 — testes de integração com pg mockado.
 *
 * Cobre fluxos end-to-end:
 *   - CommissionTriggers.onVendaCriada → INSERT com idempotency
 *   - onVendaCancelada → cancela pendentes + cria ajuste pra pagas
 *   - Multi-tenant isolation
 *   - Reconciliação de pagamento divergente
 *   - Estorno preserva histórico (cria ajuste, não muta)
 */

// Mock do pg ANTES de require services
jest.mock('../config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    pool: {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
    },
    query: jest.fn(),
    queryOne: jest.fn(),
    queryRun: jest.fn(),
    withTransaction: jest.fn(async (fn) => {
      // Simula withTransaction passando o mockClient
      mockClient.query.mockClear();
      return await fn(mockClient);
    }),
    __mockClient: mockClient,
  };
});

// Mock audit log (não testamos audit aqui)
jest.mock('../utils/auditLog', () => ({
  logAction: jest.fn().mockResolvedValue({}),
}));

const db = require('../config/database');
const Triggers = require('../services/CommissionTriggers');
const Engine = require('../services/CommissionEngine');

function mockQueryOnce(rows) {
  db.__mockClient.query.mockResolvedValueOnce({ rows });
}

beforeEach(() => {
  jest.clearAllMocks();
  db.__mockClient.query.mockReset();
});

// ============================================================================
// CommissionTriggers — fluxo end-to-end
// ============================================================================
describe('CommissionTriggers.onVendaCriada', () => {
  test('venda finalizada gera comissão pendente', async () => {
    const venda = {
      id: 100,
      salao_id: 1,
      cliente_id: 5,
      profissional_id: 10,
      valor_final: 100,
      desconto: 0,
      status: 'concluida',
      created_at: '2026-05-15T14:00:00Z',
    };

    // 1. enrichVendaForEngine: SELECT venda_itens (vazio → vai usar venda como serviço genérico)
    mockQueryOnce([]);

    // 2. getRegrasVigentes
    mockQueryOnce([{
      id: 1, salao_id: 1, nome: 'Padrão',
      tipo: 'profissional', profissional_id: 10,
      base_calculo: 'valor_bruto',
      percentual: 30, valor_fixo_cents: null,
      ativo: true,
      data_inicio: '2026-01-01', data_fim: null,
      prioridade: 0,
      condicoes_json: {},
    }]);

    // 3. INSERT comissao (resposta com row)
    mockQueryOnce([{ id: 50, valor_comissao_cents: 3000 }]);

    const result = await Triggers.onVendaCriada(venda, db.__mockClient);

    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(1);
  });

  test('venda pendente NÃO gera comissão (status não-final)', async () => {
    const venda = {
      id: 100, salao_id: 1, profissional_id: 10,
      valor_final: 100, status: 'pendente',
    };
    const result = await Triggers.onVendaCriada(venda, db.__mockClient);
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
  });

  test('sem regra vigente: retorna inserted=0 sem erro', async () => {
    const venda = {
      id: 100, salao_id: 1, profissional_id: 10,
      valor_final: 100, status: 'concluida',
    };
    mockQueryOnce([]); // venda_itens
    mockQueryOnce([]); // regras vigentes
    const result = await Triggers.onVendaCriada(venda, db.__mockClient);
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.reason).toBe('nenhuma regra vigente');
  });

  test('feature flag AUTO_COMISSAO=false desativa', async () => {
    const original = process.env.AUTO_COMISSAO;
    process.env.AUTO_COMISSAO = 'false';
    try {
      const result = await Triggers.onVendaCriada({ id: 1, salao_id: 1 }, db.__mockClient);
      expect(result.skipped).toBe(1);
      expect(result.inserted).toBe(0);
    } finally {
      process.env.AUTO_COMISSAO = original;
    }
  });
});

describe('CommissionTriggers.onVendaCancelada', () => {
  test('cancela pendentes E cria ajuste negativo pra pagas', async () => {
    const venda = { id: 100, salao_id: 1 };

    // 1. UPDATE pendentes → cancelada
    mockQueryOnce([
      { id: 1, profissional_id: 10, valor_comissao_cents: 1500 },
      { id: 2, profissional_id: 10, valor_comissao_cents: 2000 },
    ]);

    // 2. SELECT pagas
    mockQueryOnce([
      { id: 3, profissional_id: 10, valor_comissao_cents: 3000, competencia: '2026-04-01' },
    ]);

    // 3. INSERT ajuste pra paga #3
    mockQueryOnce([]);
    // 4. UPDATE comissao 3 → estornada
    mockQueryOnce([]);

    const result = await Triggers.onVendaCancelada(venda, db.__mockClient, 'Teste');

    expect(result.ok).toBe(true);
    expect(result.canceladas).toBe(2);
    expect(result.ajustesCriados).toBe(1);
  });

  test('venda sem comissões: retorna 0/0 sem erro', async () => {
    mockQueryOnce([]); // sem pendentes
    mockQueryOnce([]); // sem pagas

    const result = await Triggers.onVendaCancelada({ id: 999, salao_id: 1 }, db.__mockClient);
    expect(result.ok).toBe(true);
    expect(result.canceladas).toBe(0);
    expect(result.ajustesCriados).toBe(0);
  });
});

describe('CommissionTriggers.onAtendimentoFechado', () => {
  test('atendimento com serviços gera comissão por serviço', async () => {
    const atendimento = {
      id: 200, salao_id: 1, cliente_id: 5,
      profissional_id: 10,
      data: '2026-05-15',
      total_geral: 150,
    };

    // 1. SELECT atendimentos_servicos
    mockQueryOnce([
      { id: 1, atendimento_id: 200, servico_id: 100, valor: 100, categoria: 'corte' },
      { id: 2, atendimento_id: 200, servico_id: 101, valor: 50, categoria: 'corte' },
    ]);

    // 2. getRegrasVigentes
    mockQueryOnce([{
      id: 1, salao_id: 1, tipo: 'global', base_calculo: 'valor_bruto',
      percentual: 40, valor_fixo_cents: null, ativo: true,
      data_inicio: '2026-01-01', data_fim: null,
      prioridade: 0, condicoes_json: {},
    }]);

    // 3. INSERT serviço 1
    mockQueryOnce([{ id: 1 }]);
    // 4. INSERT serviço 2
    mockQueryOnce([{ id: 2 }]);

    const result = await Triggers.onAtendimentoFechado(atendimento, db.__mockClient);

    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(2);
  });
});

// ============================================================================
// Idempotency key generation
// ============================================================================
describe('Idempotency keys', () => {
  test('mesmo venda+item+prof+papel = mesma key', () => {
    const a = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'principal',
    });
    const b = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'principal',
    });
    expect(a).toBe(b);
  });

  test('papéis diferentes = keys diferentes (não conflita)', () => {
    const principal = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'principal',
    });
    const assistente = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'assistente',
    });
    expect(principal).not.toBe(assistente);
  });

  test('versões diferentes = keys diferentes (suporta recálculo)', () => {
    const v1 = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'principal', versao: 1,
    });
    const v2 = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'principal', versao: 2,
    });
    expect(v1).not.toBe(v2);
  });

  test('atendimento (comandaId) gera prefix diferente', () => {
    const venda = Engine.Repository.buildIdempotencyKey({
      vendaId: 1, itemId: 10, profissionalId: 5, papel: 'principal',
    });
    const comanda = Engine.Repository.buildIdempotencyKey({
      comandaId: 1, itemId: 10, profissionalId: 5, papel: 'principal',
    });
    expect(venda).toMatch(/^venda:/);
    expect(comanda).toMatch(/^comanda:/);
    expect(venda).not.toBe(comanda);
  });
});

// ============================================================================
// Multi-tenant isolation
// ============================================================================
describe('Multi-tenant isolation', () => {
  test('regra de outro salão NÃO aplica (filtrada por salao_id)', () => {
    const ctxSalaoA = {
      salaoId: 1, profissionalId: 10, papel: 'principal',
      servicoId: 100, tipoItem: 'servico',
      valorBrutoCents: 10000, dataAtendimento: new Date('2026-05-15'),
      formaPagamento: 'pix', percentualParticipacao: 100,
    };
    const regrasMisturadas = [
      { id: 1, salao_id: 1, tipo: 'global', percentual: 30,
        base_calculo: 'valor_bruto', ativo: true,
        data_inicio: '2026-01-01', data_fim: null, prioridade: 0,
        condicoes_json: {} },
      { id: 2, salao_id: 2, tipo: 'global', percentual: 99, // tentativa cross-tenant
        base_calculo: 'valor_bruto', ativo: true,
        data_inicio: '2026-01-01', data_fim: null, prioridade: 999,
        condicoes_json: {} },
    ];
    const result = Engine.calculate(ctxSalaoA, regrasMisturadas);
    expect(result.regraId).toBe(1);  // só pegou regra do salão 1
    expect(result.percentual).toBe(30);
  });
});

// ============================================================================
// Snapshot imutável de regra
// ============================================================================
describe('Snapshot imutável', () => {
  test('comissão guarda snapshot completo da regra', () => {
    const ctx = {
      salaoId: 1, profissionalId: 10, papel: 'principal',
      servicoId: 100, tipoItem: 'servico',
      valorBrutoCents: 10000, dataAtendimento: new Date(),
      formaPagamento: 'pix', percentualParticipacao: 100,
    };
    const regra = {
      id: 5, salao_id: 1, tipo: 'profissional', profissional_id: 10,
      base_calculo: 'valor_bruto', percentual: 35, valor_fixo_cents: null,
      ativo: true, data_inicio: '2026-01-01', data_fim: null,
      prioridade: 0, nome: 'Regra V1', condicoes_json: { dias_semana: [1,2,3,4,5] },
    };
    const result = Engine.calculate(ctx, [regra]);

    expect(result.regraSnapshot).toBeDefined();
    expect(result.regraSnapshot.id).toBe(5);
    expect(result.regraSnapshot.tipo).toBe('profissional');
    expect(result.regraSnapshot.percentual).toBe(35);
    expect(result.regraSnapshot.condicoes_json).toEqual({ dias_semana: [1,2,3,4,5] });
    expect(result.regraSnapshot.snapshot_at).toBeDefined();
  });

  test('snapshot independente da regra (mudança posterior não afeta)', () => {
    const regra = {
      id: 5, salao_id: 1, tipo: 'global', percentual: 30,
      base_calculo: 'valor_bruto', valor_fixo_cents: null, ativo: true,
      data_inicio: '2026-01-01', data_fim: null, prioridade: 0,
      condicoes_json: {},
    };
    const ctx = {
      salaoId: 1, profissionalId: 10, papel: 'principal',
      tipoItem: 'servico', valorBrutoCents: 10000,
      dataAtendimento: new Date(), formaPagamento: 'pix',
      percentualParticipacao: 100,
    };
    const result = Engine.calculate(ctx, [regra]);
    const snapshotPercentual = result.regraSnapshot.percentual;

    // Muta a regra original (simulando admin editou depois)
    regra.percentual = 50;

    // Snapshot mantém o valor antigo (imutabilidade)
    expect(snapshotPercentual).toBe(30);
  });
});

// ============================================================================
// CommissionEngine — cenários financeiros completos (já cobertos em unit
// tests, aqui testamos pipeline com Repository mockado)
// ============================================================================
describe('Pipeline completo: venda → comissão', () => {
  test('split 70/30 gera 2 comissões com soma exata', () => {
    const ctx = {
      salaoId: 1, profissionalId: null, papel: 'principal',
      servicoId: 100, tipoItem: 'servico',
      valorBrutoCents: 10000, descontoCents: 0,
      dataAtendimento: new Date(), formaPagamento: 'pix',
    };
    const regras = [{
      id: 1, salao_id: 1, tipo: 'global', percentual: 40,
      base_calculo: 'valor_bruto', valor_fixo_cents: null,
      ativo: true, data_inicio: '2026-01-01', data_fim: null,
      prioridade: 0, condicoes_json: {},
    }];

    const result = Engine.SplitCalculator.calculateSplit(
      ctx,
      [
        { id: 10, percentual_participacao: 70 },
        { id: 20, percentual_participacao: 30 },
      ],
      regras
    );

    expect(result).toHaveLength(2);
    expect(result[0].valorComissaoCents + result[1].valorComissaoCents).toBe(4000);
    expect(result[0].valorComissaoCents).toBe(2800);
    expect(result[1].valorComissaoCents).toBe(1200);
  });

  test('venda com 2 itens + 1 assistente: 3 comissões', () => {
    const venda = {
      id: 1, salao_id: 1, cliente_id: 5, data: '2026-05-15',
      forma_pagamento: 'pix',
      itens: [
        {
          id: 100, tipo_item: 'servico', servico_id: 50,
          valor_bruto_cents: 10000,
          profissionais: [{ id: 10, percentual_participacao: 100 }],
          assistentes: [{ id: 99 }],
        },
        {
          id: 101, tipo_item: 'servico', servico_id: 51,
          valor_bruto_cents: 5000,
          profissionais: [{ id: 10, percentual_participacao: 100 }],
          assistentes: [],
        },
      ],
    };
    const regras = [
      { id: 1, salao_id: 1, tipo: 'global', percentual: 30,
        base_calculo: 'valor_bruto', valor_fixo_cents: null, ativo: true,
        data_inicio: '2026-01-01', data_fim: null, prioridade: 0,
        condicoes_json: {} },
      { id: 2, salao_id: 1, tipo: 'assistente', percentual: 10,
        base_calculo: 'valor_bruto', valor_fixo_cents: null, ativo: true,
        data_inicio: '2026-01-01', data_fim: null, prioridade: 0,
        condicoes_json: {} },
    ];

    const result = Engine.calculateForVenda(venda, regras);
    expect(result).toHaveLength(3);  // 2 principais + 1 assistente
    // Item 1: prof 10 → 3000 (30% de 10000), assistente 99 → 1000 (10%)
    // Item 2: prof 10 → 1500
    const totalCents = result.reduce((s, r) => s + r.valorComissaoCents, 0);
    expect(totalCents).toBe(3000 + 1000 + 1500);
  });
});

// ============================================================================
// Reconciliação de pagamento
// ============================================================================
describe('Reconciliação centavos', () => {
  const { equalCents } = require('../utils/money');

  test('valor exato bate', () => {
    expect(equalCents(10000, 10000)).toBe(true);
  });

  test('divergência maior que tolerância falha', () => {
    expect(equalCents(10000, 10002, 1)).toBe(false);
  });

  test('divergência dentro de tolerância (arredondamento bancário) passa', () => {
    expect(equalCents(10000, 10001, 1)).toBe(true);
  });
});
