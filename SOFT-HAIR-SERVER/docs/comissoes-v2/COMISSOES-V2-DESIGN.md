# Comissões V2 — Design Doc

> Reescrita profunda do módulo de comissões. Baseado em sistemas profissionais (Avec, HBS, Hair Beauty).
> Status atual auditado em `AUDIT-COMISSOES.md`.

---

## 1. Princípios

1. **Imutabilidade financeira**: nada é apagado. Comissão paga é histórica. Mudanças geram ajustes.
2. **Snapshot de regra**: cada comissão guarda JSON da regra que a gerou. Mudar a regra não muta o passado.
3. **Inteiros centavos**: zero `float`. Tudo em `INTEGER` (centavos) ou `NUMERIC(14,2)` no PG.
4. **Idempotência**: gerar comissão da mesma venda 2x = 0 duplicatas (`idempotency_key`).
5. **Auditoria total**: toda mutação cria linha em `audit_log` + `regra_snapshot_json` na comissão.
6. **Multi-tenant fechado**: `salao_id` em todas as queries. Engine valida antes de inserir.
7. **Cálculo puro**: `CommissionEngine` não toca DB. Recebe contexto, retorna resultado. Testável.
8. **Compat retroativa**: endpoints v1 continuam funcionando. v2 paralelo.

---

## 2. Decisão Electron: **Opção B** (bloqueio offline)

**Por que B e não A:**

Comissão é **financeira**. Cliente offline calculando comissão local com regras desatualizadas = erro de R$ contra profissional. Profissional notar discrepância depois = quebra de confiança.

Operação financeira offline aceita = adiantamento/transferência bancária errada. Risco assimétrico: ganhar pouco em UX, perder muito em correção.

**Implementação:**
- Electron `routes/comissoes.js`: retorna 503 com `{ success: false, error: 'comissoes_offline_indisponivel', message: 'Comissões exigem conexão com servidor central' }`.
- Frontend: detecta 503 e mostra banner amarelo "Modo offline: comissões indisponíveis. Conecte-se ao servidor."
- Quando arquitetura B (cérebro local) for adotada: backend embarcado deixa de existir; tudo passa pelo cérebro. Aí comissão funciona normal porque cérebro tá no salão.

**Conclusão:** Electron embarcado NÃO calcula comissão. Sempre delega ao servidor (Render ou cérebro local).

---

## 3. Novo modelo de dados

### 3.1. `regras_comissao` (NOVA)

Tabela central de configuração.

```sql
CREATE TABLE regras_comissao (
  id              BIGSERIAL PRIMARY KEY,
  salao_id        INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  descricao       TEXT,

  -- Tipo da regra (determina o alvo)
  tipo            TEXT NOT NULL CHECK (tipo IN (
                    'global',         -- salão inteiro
                    'profissional',   -- 1 profissional
                    'servico',        -- 1 serviço
                    'produto',        -- 1 produto
                    'categoria_servico',
                    'categoria_produto',
                    'profissional_servico',  -- combinação
                    'profissional_produto',
                    'assistente',
                    'meta',           -- escalonada (vê metas_comissao_faixas)
                    'dia_semana',
                    'horario'
                  )),

  -- Alvos (FK opcionais, conforme tipo)
  profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
  servico_id      INTEGER REFERENCES servicos(id) ON DELETE CASCADE,
  produto_id      INTEGER REFERENCES produtos(id) ON DELETE CASCADE,
  categoria       TEXT,

  -- Configuração de cálculo
  base_calculo    TEXT NOT NULL CHECK (base_calculo IN (
                    'valor_bruto',
                    'valor_com_desconto',
                    'valor_liquido',           -- bruto - desconto - taxa_cartao
                    'valor_liquido_sem_taxas',
                    'lucro_bruto'              -- só produto: preco - custo
                  )),
  percentual      NUMERIC(7,4),               -- 30.0000 = 30%, max 100, NULL se valor_fixo
  valor_fixo_cents INTEGER,                   -- R$ 25 = 2500. NULL se percentual

  -- Vigência
  data_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim        DATE,                       -- NULL = sem fim
  ativo           BOOLEAN NOT NULL DEFAULT true,

  -- Prioridade (maior = vence em empates de hierarquia)
  prioridade      INTEGER NOT NULL DEFAULT 0,

  -- Condições adicionais (JSON livre pra extensão)
  -- Ex: { "dias_semana": [1,2,3,4,5], "hora_inicio": "09:00", "hora_fim": "18:00",
  --       "formas_pagamento": ["dinheiro","pix"], "valor_minimo_cents": 5000 }
  condicoes_json  JSONB NOT NULL DEFAULT '{}',

  criado_por      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (percentual IS NOT NULL AND valor_fixo_cents IS NULL)
    OR (percentual IS NULL AND valor_fixo_cents IS NOT NULL)
  )
);

CREATE INDEX idx_regras_comissao_salao_tipo_ativo
  ON regras_comissao(salao_id, tipo, ativo) WHERE ativo = true;
CREATE INDEX idx_regras_comissao_vigencia
  ON regras_comissao(salao_id, data_inicio, data_fim) WHERE ativo = true;
CREATE INDEX idx_regras_comissao_profissional
  ON regras_comissao(profissional_id) WHERE profissional_id IS NOT NULL;
```

### 3.2. `metas_comissao_faixas` (NOVA)

Faixas escalonadas. Pertencem a uma regra `tipo='meta'`.

```sql
CREATE TABLE metas_comissao_faixas (
  id               BIGSERIAL PRIMARY KEY,
  regra_id         BIGINT NOT NULL REFERENCES regras_comissao(id) ON DELETE CASCADE,
  ordem            INTEGER NOT NULL,           -- 1, 2, 3...
  faixa_inicio_cents INTEGER NOT NULL,         -- inclusivo
  faixa_fim_cents  INTEGER,                    -- exclusivo, NULL = infinito
  percentual       NUMERIC(7,4) NOT NULL,
  modo             TEXT NOT NULL CHECK (modo IN ('progressivo','retroativo')),
  tipo_base        TEXT NOT NULL CHECK (tipo_base IN (
                     'faturamento_cents',       -- soma valor_bruto vendas
                     'quantidade_servicos',
                     'ticket_medio_cents',
                     'lucro_cents'
                   )),
  periodo          TEXT NOT NULL DEFAULT 'mensal' CHECK (periodo IN (
                     'mensal','semanal','quinzenal','personalizado'
                   )),

  CHECK (faixa_fim_cents IS NULL OR faixa_fim_cents > faixa_inicio_cents)
);

CREATE INDEX idx_metas_faixas_regra_ordem ON metas_comissao_faixas(regra_id, ordem);
```

**Exemplo:** regra "Meta Janeiro 2026" tipo=meta:
- Faixa 1: 0–5000 reais → 30%, progressivo
- Faixa 2: 5000–10000 → 35%, progressivo
- Faixa 3: 10000+ → 40%, progressivo

Modo `retroativo`: ao bater R$ 10k, **todas** as comissões do mês recalculam a 40%. Engine deve gerar **ajuste positivo** retroativo, nunca alterar comissões antigas.

### 3.3. `comissoes` (EXPANDIDA)

Adicionar colunas. Manter compat com endpoints v1.

```sql
ALTER TABLE comissoes
  ADD COLUMN IF NOT EXISTS comanda_id        INTEGER REFERENCES atendimentos(id),
  ADD COLUMN IF NOT EXISTS item_venda_id     INTEGER,
  ADD COLUMN IF NOT EXISTS cliente_id        INTEGER REFERENCES clientes(id),
  ADD COLUMN IF NOT EXISTS servico_id        INTEGER REFERENCES servicos(id),
  ADD COLUMN IF NOT EXISTS produto_id        INTEGER REFERENCES produtos(id),

  ADD COLUMN IF NOT EXISTS tipo_item         TEXT CHECK (tipo_item IN (
                            'servico','produto','pacote','assinatura','interno'
                          )),
  ADD COLUMN IF NOT EXISTS papel_profissional TEXT NOT NULL DEFAULT 'principal' CHECK (
                            papel_profissional IN (
                              'principal','assistente','vendedor','indicador','split'
                            )),
  ADD COLUMN IF NOT EXISTS percentual_participacao NUMERIC(7,4) DEFAULT 100.0000,
                            -- usado em split (ex: 70% / 30%)

  -- Valores em centavos para evitar float
  ADD COLUMN IF NOT EXISTS valor_bruto_cents     INTEGER,
  ADD COLUMN IF NOT EXISTS desconto_cents        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acrescimo_cents       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_cartao_cents     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_produto_cents   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_base_cents      INTEGER,   -- a base usada no cálculo
  ADD COLUMN IF NOT EXISTS valor_comissao_cents  INTEGER NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS percentual            NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS valor_fixo_cents      INTEGER,
  ADD COLUMN IF NOT EXISTS base_calculo          TEXT,

  -- Rastreabilidade total
  ADD COLUMN IF NOT EXISTS regra_id              BIGINT REFERENCES regras_comissao(id),
  ADD COLUMN IF NOT EXISTS regra_snapshot_json   JSONB,    -- regra inteira no momento

  -- Status novo, mais expressivo
  ADD COLUMN IF NOT EXISTS status                TEXT NOT NULL DEFAULT 'pendente' CHECK (
                            status IN (
                              'pendente','paga','estornada','cancelada','bloqueada'
                            )),
  ADD COLUMN IF NOT EXISTS motivo_bloqueio       TEXT,

  -- Período
  ADD COLUMN IF NOT EXISTS competencia           DATE,     -- mês de referência (1º dia)
  ADD COLUMN IF NOT EXISTS data_geracao          TIMESTAMPTZ DEFAULT NOW(),

  -- Pagamento
  ADD COLUMN IF NOT EXISTS pagamento_lote_id     BIGINT,

  -- Origem
  ADD COLUMN IF NOT EXISTS origem                TEXT NOT NULL DEFAULT 'manual' CHECK (
                            origem IN ('automatica','manual','ajuste','migracao','recalculo')
                          ),

  -- Idempotência
  ADD COLUMN IF NOT EXISTS idempotency_key       TEXT,

  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

-- Unique constraint pra idempotência
CREATE UNIQUE INDEX IF NOT EXISTS uq_comissoes_idempotency
  ON comissoes(salao_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Performance
CREATE INDEX IF NOT EXISTS idx_comissoes_salao_status_competencia
  ON comissoes(salao_id, status, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_comissoes_profissional_status
  ON comissoes(profissional_id, status);
CREATE INDEX IF NOT EXISTS idx_comissoes_venda
  ON comissoes(venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_pagamento_lote
  ON comissoes(pagamento_lote_id) WHERE pagamento_lote_id IS NOT NULL;

-- Migration de dados legacy: pago → status
UPDATE comissoes SET status = CASE
  WHEN pago = true THEN 'paga'
  ELSE 'pendente'
END WHERE status IS NULL;

-- Backfill competencia
UPDATE comissoes SET competencia = DATE_TRUNC('month', created_at)::date
  WHERE competencia IS NULL;

-- Backfill valor_comissao_cents
UPDATE comissoes
  SET valor_comissao_cents = ROUND(valor_comissao * 100)::int,
      valor_bruto_cents = ROUND(valor_total * 100)::int
  WHERE valor_comissao_cents = 0 AND valor_comissao IS NOT NULL;
```

### 3.4. `comissoes_pagamentos` (RENOMEADA + EXPANDIDA)

Substitui `comissoes_pagas` antiga (mantém alias view pra compat).

```sql
CREATE TABLE comissoes_pagamentos (
  id                BIGSERIAL PRIMARY KEY,
  salao_id          INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  profissional_id   INTEGER NOT NULL REFERENCES profissionais(id),

  valor_total_cents INTEGER NOT NULL,
  quantidade_comissoes INTEGER NOT NULL,
  quantidade_ajustes INTEGER NOT NULL DEFAULT 0,

  periodo_inicio    DATE NOT NULL,
  periodo_fim       DATE NOT NULL,

  status            TEXT NOT NULL DEFAULT 'pago' CHECK (
                      status IN ('pago','revertido','disputado')
                    ),
  observacao        TEXT,
  forma_pagamento   TEXT,                       -- dinheiro/pix/transferência

  -- Idempotência
  idempotency_key   TEXT,

  criado_por        INTEGER REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revertido_em      TIMESTAMPTZ,
  revertido_por     INTEGER REFERENCES users(id),
  motivo_reversao   TEXT
);

CREATE UNIQUE INDEX uq_pagamentos_idempotency
  ON comissoes_pagamentos(salao_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- View pra compat com endpoint /comissoes/pagas antigo
CREATE OR REPLACE VIEW comissoes_pagas AS
  SELECT
    cp.id, cp.salao_id, cp.profissional_id,
    (cp.valor_total_cents / 100.0)::numeric(14,2) AS valor,
    cp.created_at,
    cp.observacao AS observacoes,
    cp.periodo_inicio, cp.periodo_fim
  FROM comissoes_pagamentos cp
  WHERE cp.status = 'pago';
```

### 3.5. `comissoes_ajustes` (NOVA)

Bônus, descontos, adiantamentos, correções. Entram no próximo pagamento.

```sql
CREATE TABLE comissoes_ajustes (
  id               BIGSERIAL PRIMARY KEY,
  salao_id         INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  profissional_id  INTEGER NOT NULL REFERENCES profissionais(id),

  tipo             TEXT NOT NULL CHECK (tipo IN (
                     'bonus','desconto','adiantamento','correcao','meta_retroativa','estorno'
                   )),
  valor_cents      INTEGER NOT NULL,   -- positivo (a pagar) ou negativo (descontar)
  motivo           TEXT NOT NULL,

  competencia      DATE,
  comissao_origem_id BIGINT REFERENCES comissoes(id), -- se ajuste vem de estorno
  pagamento_lote_id BIGINT REFERENCES comissoes_pagamentos(id),

  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (
                     status IN ('pendente','aplicado','cancelado')
                   ),

  criado_por       INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ajustes_salao_prof_status
  ON comissoes_ajustes(salao_id, profissional_id, status);
```

### 3.6. `audit_log` (uso, já existe)

Toda mutação em comissão/regra/pagamento/ajuste cria linha:
- `action`: `comissao.gerar`, `comissao.pagar_lote`, `comissao.estornar`, `regra.criar`, `regra.atualizar`, `ajuste.criar`, etc.
- `entity_type`, `entity_id`, `before`, `after`, `user_id`, `salao_id`, `created_at`.

---

## 4. CommissionEngine — arquitetura

### 4.1. Localização

`/SOFT-HAIR-SERVER/src/services/CommissionEngine/`
```
CommissionEngine/
├── index.js              # API pública
├── RuleResolver.js       # hierarquia de regras
├── Calculator.js         # math puro (centavos)
├── SplitCalculator.js    # split entre profissionais
├── MetaCalculator.js     # progressivo/retroativo
├── BaseExtractor.js      # extrai valor_base do contexto
└── __tests__/
    ├── RuleResolver.test.js
    ├── Calculator.test.js
    ├── SplitCalculator.test.js
    ├── MetaCalculator.test.js
    └── integration.test.js
```

### 4.2. API pública

```js
// services/CommissionEngine/index.js
const RuleResolver = require('./RuleResolver');
const Calculator = require('./Calculator');
const SplitCalculator = require('./SplitCalculator');

/**
 * Calcula UMA comissão pra um item.
 *
 * @param {object} ctx
 * @param {number} ctx.salaoId
 * @param {number} ctx.profissionalId
 * @param {'principal'|'assistente'|'vendedor'|'indicador'} ctx.papel
 * @param {number|null} ctx.servicoId
 * @param {number|null} ctx.produtoId
 * @param {'servico'|'produto'|'pacote'|'assinatura'|'interno'} ctx.tipoItem
 * @param {number} ctx.valorBrutoCents
 * @param {number} ctx.descontoCents
 * @param {number} ctx.acrescimoCents
 * @param {number} ctx.taxaCartaoCents
 * @param {number} ctx.custoProdutoCents
 * @param {Date} ctx.dataAtendimento
 * @param {string} ctx.formaPagamento
 * @param {Array<object>} ctx.regrasDisponiveis  // pre-fetched
 * @param {number} ctx.percentualParticipacao = 100  // split
 *
 * @returns {object} resultado
 *   {
 *     valorComissaoCents: number,
 *     valorBaseCents: number,
 *     baseCalculo: 'valor_bruto'|...,
 *     percentual: number|null,
 *     valorFixoCents: number|null,
 *     regraId: number|null,
 *     regraSnapshot: object|null,
 *     trace: object  // pra debug: qual regra foi escolhida e por quê
 *   }
 */
function calculate(ctx) { ... }

/**
 * Calcula comissões pra venda inteira (todos os itens, todos os profissionais envolvidos).
 *
 * @param {object} venda  // venda + itens + profissionais + assistentes
 * @param {Array<object>} regrasDisponiveis
 * @returns {Array<object>}  // 1 comissão por (item × profissional)
 */
function calculateForVenda(venda, regrasDisponiveis) { ... }

/**
 * Recalcula meta progressiva/retroativa pra um profissional no período.
 *
 * @returns {{ ajustes: Array, comissoesAfetadas: Array }}
 */
function applyMeta(profissionalId, salaoId, periodo, regraMeta, comissoesExistentes) { ... }

module.exports = { calculate, calculateForVenda, applyMeta };
```

### 4.3. Hierarquia de resolução (RuleResolver)

```js
// services/CommissionEngine/RuleResolver.js
// Ordem de prioridade (maior vence):
const PRIORIDADE_TIPO = {
  'profissional_servico': 100,
  'profissional_produto': 100,
  'servico':              80,
  'produto':              80,
  'categoria_servico':    70,
  'categoria_produto':    70,
  'profissional':         60,
  'meta':                 50,
  'dia_semana':           40,
  'horario':              30,
  'global':               10,
};

function resolve(ctx, regras) {
  // 1. Filtrar regras aplicáveis (vigência, salao, condicoes_json)
  const aplicaveis = regras.filter(r => isApplicable(r, ctx));

  // 2. Ordenar por: prioridade tipo > prioridade campo > data_inicio desc
  aplicaveis.sort((a, b) => {
    const tipoA = PRIORIDADE_TIPO[a.tipo] || 0;
    const tipoB = PRIORIDADE_TIPO[b.tipo] || 0;
    if (tipoA !== tipoB) return tipoB - tipoA;
    if (a.prioridade !== b.prioridade) return b.prioridade - a.prioridade;
    return new Date(b.data_inicio) - new Date(a.data_inicio);
  });

  return aplicaveis[0] || null;
}

function isApplicable(regra, ctx) {
  // vigência
  const hoje = ctx.dataAtendimento;
  if (regra.data_inicio > hoje) return false;
  if (regra.data_fim && regra.data_fim < hoje) return false;

  // alvo
  switch (regra.tipo) {
    case 'profissional': return regra.profissional_id === ctx.profissionalId;
    case 'servico': return regra.servico_id === ctx.servicoId;
    case 'produto': return regra.produto_id === ctx.produtoId;
    case 'profissional_servico':
      return regra.profissional_id === ctx.profissionalId
          && regra.servico_id === ctx.servicoId;
    // ... etc
    case 'global': return true;
  }

  // condições JSON
  const cond = regra.condicoes_json || {};
  if (cond.dias_semana && !cond.dias_semana.includes(hoje.getDay())) return false;
  if (cond.formas_pagamento && !cond.formas_pagamento.includes(ctx.formaPagamento)) return false;
  if (cond.valor_minimo_cents && ctx.valorBrutoCents < cond.valor_minimo_cents) return false;

  return true;
}
```

### 4.4. Cálculo (Calculator)

**Centavos sempre. Sem float.**

```js
function calculate(valorBaseCents, regra) {
  if (regra.valor_fixo_cents != null) {
    return regra.valor_fixo_cents;
  }
  // percentual em NUMERIC(7,4): "30.0000" = 30%
  // valor = base × percentual / 100, arredondado meio-pra-cima
  const raw = (valorBaseCents * Number(regra.percentual)) / 100;
  return Math.round(raw);  // banker's rounding pode ser melhor, mas Math.round basta
}

function extractBase(ctx, baseCalculo) {
  const bruto = ctx.valorBrutoCents;
  const desc = ctx.descontoCents || 0;
  const acr = ctx.acrescimoCents || 0;
  const taxa = ctx.taxaCartaoCents || 0;
  const custo = ctx.custoProdutoCents || 0;

  switch (baseCalculo) {
    case 'valor_bruto':            return bruto;
    case 'valor_com_desconto':     return bruto - desc + acr;
    case 'valor_liquido':          return bruto - desc + acr - taxa;
    case 'valor_liquido_sem_taxas': return bruto - desc + acr;
    case 'lucro_bruto':            return bruto - custo;
    default: throw new Error(`base_calculo inválida: ${baseCalculo}`);
  }
}
```

### 4.5. Split (SplitCalculator)

```js
function calculateSplit(itemCtx, profissionais, regrasDisponiveis) {
  // profissionais: [{ id, papel: 'principal'|'split', percentual_participacao: 70 }]
  // Soma de participacao deve = 100
  const total = profissionais.reduce((s, p) => s + p.percentual_participacao, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Split deve somar 100%, recebeu ${total}`);
  }

  return profissionais.map(p => {
    const ctxProf = { ...itemCtx, profissionalId: p.id, papel: p.papel };
    const baseResult = calculate(ctxProf, regrasDisponiveis);
    return {
      ...baseResult,
      valorComissaoCents: Math.round(baseResult.valorComissaoCents * p.percentual_participacao / 100),
      percentualParticipacao: p.percentual_participacao,
    };
  });
}
```

### 4.6. Assistente

Regra `tipo='assistente'` com campo `condicoes_json.calcular_sobre`:
- `valor_servico` — % sobre valor bruto/líquido do serviço
- `comissao_principal` — % sobre o que o principal recebeu
- `valor_fixo` — valor fixo

```js
function calculateAssistant(itemCtx, assistentes, comissaoPrincipal, regras) {
  return assistentes.map(asst => {
    const regra = RuleResolver.resolve({ ...itemCtx, profissionalId: asst.id, papel: 'assistente' }, regras);
    if (!regra) return null;

    const calculaSobre = regra.condicoes_json?.calcular_sobre || 'valor_servico';
    let base;
    if (calculaSobre === 'comissao_principal') {
      base = comissaoPrincipal.valorComissaoCents;
    } else if (calculaSobre === 'valor_servico') {
      base = extractBase(itemCtx, regra.base_calculo);
    } else if (calculaSobre === 'valor_fixo') {
      return { ...defaults, valorComissaoCents: regra.valor_fixo_cents };
    }

    return Calculator.calculate(base, regra);
  }).filter(Boolean);
}
```

### 4.7. Meta (MetaCalculator)

```js
async function applyMeta(profissionalId, salaoId, mes, regraMeta, repository) {
  const faixas = await repository.getFaixasOrdenadas(regraMeta.id);
  const acumulado = await repository.getAcumuladoMes(profissionalId, salaoId, mes, faixas[0].tipo_base);

  const faixaAplicavel = findFaixa(acumulado, faixas);
  const comissoesExistentes = await repository.getComissoesMes(profissionalId, salaoId, mes);

  if (faixas[0].modo === 'progressivo') {
    // cada faixa aplica só no trecho
    // Recalcula valor_comissao por venda dentro da faixa correta
    return calcularProgressivo(comissoesExistentes, faixas);
  } else {
    // retroativo: ao bater meta, novo % aplica em TUDO
    // gera AJUSTE positivo (diff entre % novo e % antigo)
    return calcularRetroativo(comissoesExistentes, faixaAplicavel);
  }
}
```

**Retroativo nunca muta comissão antiga.** Sempre gera `comissoes_ajustes` tipo `meta_retroativa` com `valor_cents = (novo% - antigo%) × base`.

---

## 5. Gatilho automático

### 5.1. Pontos de integração

| Evento | Arquivo | Ação |
|--------|---------|------|
| Venda concluída | `VendaService.criar()` ou `Venda.finalizar()` | gera comissões pendentes |
| Atendimento fechado | `AtendimentoService.fechamento()` | gera comissões |
| Pagamento confirmado | `VendaService.atualizarStatus()` → 'pago' | confirma pendentes |
| Venda cancelada | `VendaService.cancelar()` | cancela comissões pendentes / estorna pagas |
| Item adicionado/removido | `VendaService.atualizar()` | recalcula se pendente / cria ajuste se pago |

### 5.2. Fluxo de geração

```
[VendaService.criar(venda)]
    ↓
[venda inserida, itens inseridos]
    ↓
[CommissionEngine.calculateForVenda(venda, regras)] ← fetch regras vigentes
    ↓
[para cada resultado:]
    ↓
    INSERT INTO comissoes (
      idempotency_key = `venda:${venda.id}:item:${item.id}:prof:${prof.id}:papel:${papel}`,
      status = 'pendente',
      origem = 'automatica',
      regra_snapshot_json = <regra completa>,
      ...
    ) ON CONFLICT (salao_id, idempotency_key) DO NOTHING
    ↓
[audit_log: 'comissao.gerar_automatica']
```

**Idempotency key garante:** chamar `criar(venda)` 2x = 0 comissões duplicadas.

### 5.3. Venda cancelada

```js
async function cancelar(vendaId, motivo, userId, salaoId) {
  await withTransaction(async (client) => {
    // 1. Cancelar comissões pendentes
    await client.query(`
      UPDATE comissoes SET status='cancelada', updated_at=NOW()
      WHERE venda_id=$1 AND salao_id=$2 AND status='pendente'
    `, [vendaId, salaoId]);

    // 2. Estornar comissões pagas → cria AJUSTE negativo
    const pagas = await client.query(`
      SELECT id, profissional_id, valor_comissao_cents, competencia
      FROM comissoes
      WHERE venda_id=$1 AND salao_id=$2 AND status='paga'
    `, [vendaId, salaoId]);

    for (const c of pagas.rows) {
      await client.query(`
        INSERT INTO comissoes_ajustes
          (salao_id, profissional_id, tipo, valor_cents, motivo, competencia, comissao_origem_id, criado_por)
        VALUES ($1, $2, 'estorno', $3, $4, $5, $6, $7)
      `, [salaoId, c.profissional_id, -c.valor_comissao_cents,
          `Venda ${vendaId} cancelada: ${motivo}`, c.competencia, c.id, userId]);

      await client.query(`UPDATE comissoes SET status='estornada' WHERE id=$1`, [c.id]);
    }

    // 3. audit
    await logAction({ action: 'venda.cancelar_com_estorno', ... });
  });
}
```

### 5.4. Venda editada

```js
async function atualizarItens(vendaId, novosItens, userId, salaoId) {
  await withTransaction(async (client) => {
    const comissoesPendentes = await getComissoesPendentes(vendaId, salaoId, client);
    const comissoesPagas = await getComissoesPagas(vendaId, salaoId, client);

    if (comissoesPagas.length === 0) {
      // só pendentes — pode recalcular
      await deletarComissoesPendentes(vendaId, salaoId, client);
      // re-gerar (idempotency_key novo por incluir version/hash dos itens)
      await gerarComissoes(vendaId, novosItens, salaoId, client);
    } else {
      // já pagas — não toca, gera ajustes
      const dif = calcularDiferenca(itensAntigos, novosItens);
      for (const ajuste of dif) {
        await client.query(`INSERT INTO comissoes_ajustes ...`);
      }
    }
  });
}
```

---

## 6. Endpoints v2

Path: `/api/v2/comissoes/*`. v1 segue funcionando.

### 6.1. Regras

```
GET    /api/v2/comissoes/regras            # lista com filtros
GET    /api/v2/comissoes/regras/:id        # detalhe
POST   /api/v2/comissoes/regras            # criar (admin)
PUT    /api/v2/comissoes/regras/:id        # editar (admin)
DELETE /api/v2/comissoes/regras/:id        # soft delete: ativo=false (admin)
POST   /api/v2/comissoes/regras/:id/clonar # duplicar pra editar
```

### 6.2. Metas

```
GET    /api/v2/comissoes/metas
POST   /api/v2/comissoes/metas             # cria regra tipo=meta + faixas em transação
PUT    /api/v2/comissoes/metas/:id
POST   /api/v2/comissoes/metas/:id/aplicar # roda MetaCalculator no período
```

### 6.3. Ajustes

```
GET    /api/v2/comissoes/ajustes           # filtro por profissional, status, tipo
POST   /api/v2/comissoes/ajustes           # admin cria bonus/desconto/adiantamento/correcao
PUT    /api/v2/comissoes/ajustes/:id       # editar status (cancelar)
DELETE /api/v2/comissoes/ajustes/:id       # soft cancel
```

### 6.4. Comissões

```
GET    /api/v2/comissoes                   # filtros expandidos (status, papel, tipo_item, regra_id, periodo)
GET    /api/v2/comissoes/:id               # detalhe + regra_snapshot + audit history
POST   /api/v2/comissoes                   # criar manual (admin)
PUT    /api/v2/comissoes/:id/bloquear      # bloqueia pagamento (admin) com motivo
PUT    /api/v2/comissoes/:id/desbloquear   # admin
POST   /api/v2/comissoes/:id/estornar      # gera ajuste negativo (admin)
POST   /api/v2/comissoes/recalcular        # recalcula comissões pendentes de uma venda
```

### 6.5. Pagamentos

```
POST   /api/v2/comissoes/pagamentos
  body: {
    profissional_id,
    data_inicio, data_fim,    // OR comissoes_ids: [...]
    incluir_ajustes: true,
    valor_confirmado_cents,
    observacao,
    forma_pagamento,
    idempotency_key
  }
  resposta: {
    pagamento_id,
    valor_total_cents,
    comissoes_pagas: [...],
    ajustes_aplicados: [...]
  }

GET    /api/v2/comissoes/pagamentos        # histórico
GET    /api/v2/comissoes/pagamentos/:id    # detalhe + itens
POST   /api/v2/comissoes/pagamentos/:id/reverter   # admin
```

### 6.6. Extrato / Dashboard / Simulador

```
GET /api/v2/comissoes/extrato/:profissionalId?periodo=2026-01
  resposta: holerite estruturado
    - identificacao
    - periodo
    - pendentes: [...]
    - pagas: [...]
    - ajustes: [...]
    - total_pendente_cents
    - total_pago_cents
    - total_ajustes_cents
    - liquido_a_pagar_cents

GET /api/v2/comissoes/dashboard?periodo=2026-01
  resposta: agregados (total pendente/pago/estornado, top 10 profissionais, comissão vs faturamento, etc)

POST /api/v2/comissoes/simulador
  body: { profissional_id, servico_id|produto_id, valor_bruto_cents, ... }
  resposta: { regra_aplicada, valor_comissao_cents, trace }
```

---

## 7. Frontend (telas novas)

### 7.1. `/comissoes/regras` (nova)

- Lista paginada com filtros (tipo, ativo, profissional, serviço)
- Botão "Nova Regra" → wizard de criação
- Cada linha tem botões: editar, duplicar, ativar/desativar
- Modal "Simulador" embutido: testa a regra com dados fictícios

### 7.2. `/comissoes` (refatorada)

Substitui `Administrativo.jsx > ComissoesSection`. Tabs:
- **Pendentes** — filtros por profissional, período. Multi-select pra pagar em lote
- **Pagas** — histórico
- **Estornadas/Canceladas** — auditoria
- **Ajustes** — bonus/desconto/adiantamentos

Card de comissão expandível mostra:
- Venda/atendimento de origem
- Cliente, serviço/produto
- Base, percentual, valor
- Regra aplicada (link pra ver snapshot)
- Histórico de mudanças (audit)

### 7.3. `/comissoes/extrato/:profissionalId` (nova)

"Holerite" do profissional. Visual de contracheque:
- Cabeçalho: profissional, período, total líquido
- Tabela de atendimentos com base/percentual/valor
- Tabela de ajustes
- Tabela de pagamentos já feitos
- Botão "Exportar PDF" / "Exportar CSV"

### 7.4. `/comissoes/pagamento` (nova)

Wizard:
1. **Selecionar profissional**
2. **Selecionar período** (calendário)
3. **Revisar comissões e ajustes** (checkbox)
4. **Confirmar valor** (campo de input que valida contra soma)
5. **Forma de pagamento + observação**
6. **Confirmar**

Mostra erro claro se `valor_confirmado` divergir.

### 7.5. `/comissoes/dashboard` (nova)

Cards e gráficos (recharts):
- Top 10 profissionais (barras)
- Comissão vs faturamento (linha)
- Distribuição por categoria (donut)
- Pendente vs pago vs estornado (stacked bar)

---

## 8. Testes (Jest)

```
SOFT-HAIR-SERVER/tests/comissoes-v2/
├── CommissionEngine.test.js
│   ├── calcula comissão padrão do profissional
│   ├── serviço vence profissional (prioridade)
│   ├── profissional_servico vence todos
│   ├── produto: lucro_bruto
│   ├── valor_liquido_sem_taxas
│   ├── condições json: dia_semana
│   ├── condições json: forma_pagamento
│   ├── condições json: valor_minimo
│   └── snapshot da regra salvo
├── SplitCalculator.test.js
│   ├── split 70/30 entre 2 profissionais
│   ├── split soma != 100 → erro
│   └── 3 profissionais 33/33/34
├── Assistente.test.js
│   ├── % sobre valor_servico
│   ├── % sobre comissao_principal
│   └── valor_fixo
├── MetaCalculator.test.js
│   ├── progressivo 3 faixas
│   ├── retroativo gera ajuste
│   └── faixa única sem meta
├── VendaIntegration.test.js
│   ├── venda criada gera comissões pendentes
│   ├── venda cancelada cancela pendentes / estorna pagas
│   ├── venda editada com pagas → ajuste
│   └── idempotência: criar venda 2x → mesma quantidade comissoes
├── PagamentoLote.test.js
│   ├── pagar lote com comissões + ajustes
│   ├── reconciliação divergente bloqueia
│   ├── idempotency_key impede duplo pagamento
│   └── valor_confirmado != soma real → erro
├── MultiTenant.test.js
│   ├── salao A não vê regras do salao B
│   ├── salao A não paga comissão do salao B
│   └── tentativa cross-tenant → 403
└── Estorno.test.js
    ├── estornar pendente
    ├── estornar paga → cria ajuste negativo
    └── motivo obrigatório
```

**Meta:** >90% coverage do `CommissionEngine`. >70% das routes v2.

---

## 9. Migração de dados legacy

Script `SOFT-HAIR-SERVER/migrations/2026_comissoes_v2.sql`:

```sql
BEGIN;

-- 1. Schema novo (DDL acima)
CREATE TABLE regras_comissao (...);
CREATE TABLE metas_comissao_faixas (...);
ALTER TABLE comissoes ADD COLUMN ...;
CREATE TABLE comissoes_pagamentos_v2 (...);
CREATE TABLE comissoes_ajustes (...);

-- 2. Backfill
UPDATE comissoes SET
  status = CASE WHEN pago THEN 'paga' ELSE 'pendente' END,
  competencia = DATE_TRUNC('month', created_at)::date,
  valor_comissao_cents = ROUND(valor_comissao * 100)::int,
  valor_bruto_cents = ROUND(valor_total * 100)::int,
  origem = 'migracao',
  regra_snapshot_json = jsonb_build_object(
    'tipo','legacy','percentual', percentual,
    'created_at', created_at
  )
WHERE status IS NULL;

-- 3. Criar regra global default por salao (% padrão = profissional.comissao_percentual)
INSERT INTO regras_comissao (salao_id, nome, tipo, base_calculo, percentual, criado_por)
SELECT
  id,
  'Regra padrão (migrada)',
  'global',
  'valor_bruto',
  0,
  1  -- system user
FROM saloes
ON CONFLICT DO NOTHING;

-- 4. Criar uma regra por profissional baseada em comissao_percentual
INSERT INTO regras_comissao (salao_id, profissional_id, nome, tipo, base_calculo, percentual)
SELECT
  salao_id,
  id,
  CONCAT('Padrão: ', nome),
  'profissional',
  'valor_bruto',
  comissao_percentual
FROM profissionais
WHERE comissao_percentual > 0;

-- 5. Migrar comissoes_pagas antigas pra comissoes_pagamentos novas
INSERT INTO comissoes_pagamentos
  (salao_id, profissional_id, valor_total_cents, quantidade_comissoes,
   periodo_inicio, periodo_fim, status, observacao, created_at)
SELECT
  salao_id, profissional_id,
  ROUND(valor * 100)::int,
  COALESCE(array_length(comissoes_ids,1), 0),
  created_at::date, created_at::date,  -- período aproximado
  'pago',
  COALESCE(observacoes, 'Migrado de comissoes_pagas v1'),
  created_at
FROM comissoes_pagas;  -- a tabela antiga, antes de virar view

-- 6. Renomear tabela antiga e criar view de compat
ALTER TABLE comissoes_pagas RENAME TO comissoes_pagas_legacy;
CREATE VIEW comissoes_pagas AS SELECT ... FROM comissoes_pagamentos WHERE status='pago';

COMMIT;
```

**Rollback plan:**
- Migration em transação. Falha = rollback total.
- `comissoes_pagas_legacy` mantido por 90 dias após deploy.
- Tabelas novas podem ser dropadas (não afetam v1).

---

## 10. Compatibilidade v1

| Endpoint v1 | Status | Comportamento |
|-------------|--------|---------------|
| `GET /api/comissoes` | manter | usa tabela `comissoes` (compatível, novos campos opcionais) |
| `GET /api/comissoes/:id` | manter | idem |
| `POST /api/comissoes` | manter | cria com `origem='manual'`, gera idempotency_key automático |
| `GET /api/comissoes/pagas` | manter | usa view `comissoes_pagas` |
| `GET /api/comissoes/estornos` | manter | filtra `comissoes_ajustes WHERE tipo='estorno'` |
| `POST /api/comissoes/pagar` | manter | redireciona internamente pra v2 com defaults |
| `POST /api/comissoes/estornar` | manter | cria ajuste negativo |
| `GET /api/comissoes/resumo/:id` | manter | inclui ajustes no cálculo |
| `PUT /api/comissoes/:id/pagar` | manter | wrapper de v2 |

Frontend antigo continua funcionando sem mudanças. Novo frontend usa v2.

---

## 11. Plano de execução faseado

### Fase 1 — fundação (1-2 dias)
- Migrations
- CommissionEngine + testes unitários
- Backfill scripts
- Não toca produção ainda

### Fase 2 — backend v2 (2 dias)
- Routes v2
- Integração com VendaService/AtendimentoService (com feature flag)
- Testes de integração
- Endpoints v1 ainda funcionam intactos

### Fase 3 — frontend (2-3 dias)
- Tela de Regras
- Refactor da tela de Comissões
- Extrato
- Pagamento wizard

### Fase 4 — produção (1 dia)
- Migration em produção (off-hours, com backup)
- Ligar feature flag de geração automática (gradual: 1 salão piloto → todos)
- Monitorar audit_log + comparar com fechamento manual
- Rollback plan: feature flag off, dados ficam, endpoints v1 mantêm app vivo

### Fase 5 — Electron (½ dia)
- Stub de routes/comissoes.js que retorna 503
- Banner no frontend quando offline

---

## 12. Validação em produção

**Smoke tests pós-deploy:**

```bash
# 1. Migration aplicada
curl -s $API/api/health | jq

# 2. Endpoints v1 funcionam
curl -H "Authorization: Bearer $TOKEN" $API/api/comissoes | jq '.data | length'

# 3. Endpoints v2 respondem
curl -H "Authorization: Bearer $TOKEN" $API/api/v2/comissoes/regras | jq

# 4. Cria venda de teste e verifica comissão gerada
curl -X POST -H "Authorization: Bearer $TOKEN" -d '{...}' $API/api/vendas
sleep 1
curl -H "Authorization: Bearer $TOKEN" $API/api/v2/comissoes?venda_id=$ID | jq

# 5. Simulador
curl -X POST -H "Authorization: Bearer $TOKEN" -d '{...}' $API/api/v2/comissoes/simulador | jq

# 6. Multi-tenant: token de outro salão NÃO vê
curl -H "Authorization: Bearer $TOKEN_B" $API/api/v2/comissoes/regras?salao_id=$A | jq
```

**Métricas a monitorar 48h:**
- Taxa de erro em `/api/v2/comissoes/*` < 0.5%
- Quantidade de `comissoes` geradas em automatica vs vendas criadas (deve casar 1:N)
- Divergência entre `comissoes_pagamentos.valor_total_cents` e `SUM(comissoes.valor_comissao_cents)` (deve ser 0)
- Tempo de response P95 em `POST /api/v2/comissoes/pagamentos` < 500ms

---

## 13. Checklist de pronto

- [ ] Audit doc gerado
- [ ] Design doc revisado e aprovado pelo Gui
- [ ] Migrations escritas + testadas em staging
- [ ] CommissionEngine implementado + 90% coverage
- [ ] Endpoints v2 implementados
- [ ] Frontend novo
- [ ] Backfill testado em snapshot da prod
- [ ] Deploy em horário de baixa
- [ ] Smoke tests OK
- [ ] Rollback testado
- [ ] Documentação user-facing (admin do salão)

---

**Autor:** Claude + Gui · **Status:** PROPOSTA · **Versão:** 1.0
