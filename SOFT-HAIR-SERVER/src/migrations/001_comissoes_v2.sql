-- ============================================================================
-- Migration 001: Comissões V2
-- ============================================================================
-- Cria nova arquitetura de comissões: regras configuráveis, snapshot de regra,
-- centavos integer, status enum, idempotência, ajustes, metas escalonadas.
--
-- Compatibilidade: NÃO remove campos antigos. Endpoints v1 continuam funcionando.
-- Backfill: registros legados ganham status/competencia/cents/origem='migracao'.
--
-- Reversível? Parcialmente. Tabelas novas podem ser DROP-adas. Colunas adicionadas
-- em `comissoes` ficam. Veja rollback no final.
-- ============================================================================
-- NOTA: transação é controlada pelo runner (initDb.applySqlMigrations).
-- Não usar BEGIN/COMMIT aqui — duplicar transação confunde o pg client.

-- ---------------------------------------------------------------------------
-- 1. regras_comissao — configuração central de regras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regras_comissao (
  id              BIGSERIAL PRIMARY KEY,
  salao_id        INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  descricao       TEXT,

  tipo            TEXT NOT NULL CHECK (tipo IN (
                    'global',
                    'profissional',
                    'servico',
                    'produto',
                    'categoria_servico',
                    'categoria_produto',
                    'profissional_servico',
                    'profissional_produto',
                    'assistente',
                    'meta',
                    'dia_semana',
                    'horario'
                  )),

  profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
  servico_id      INTEGER REFERENCES servicos(id) ON DELETE CASCADE,
  produto_id      INTEGER REFERENCES produtos(id) ON DELETE CASCADE,
  categoria       TEXT,

  base_calculo    TEXT NOT NULL CHECK (base_calculo IN (
                    'valor_bruto',
                    'valor_com_desconto',
                    'valor_liquido',
                    'valor_liquido_sem_taxas',
                    'lucro_bruto'
                  )),
  percentual      NUMERIC(7,4),
  valor_fixo_cents INTEGER,

  data_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim        DATE,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  prioridade      INTEGER NOT NULL DEFAULT 0,

  condicoes_json  JSONB NOT NULL DEFAULT '{}',

  criado_por      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT regra_percentual_xor_fixo CHECK (
    (percentual IS NOT NULL AND valor_fixo_cents IS NULL)
    OR (percentual IS NULL AND valor_fixo_cents IS NOT NULL)
  ),
  CONSTRAINT regra_percentual_range CHECK (
    percentual IS NULL OR (percentual >= 0 AND percentual <= 100)
  ),
  CONSTRAINT regra_data_fim_apos_inicio CHECK (
    data_fim IS NULL OR data_fim >= data_inicio
  )
);

CREATE INDEX IF NOT EXISTS idx_regras_comissao_salao_tipo_ativo
  ON regras_comissao(salao_id, tipo, ativo);
CREATE INDEX IF NOT EXISTS idx_regras_comissao_vigencia
  ON regras_comissao(salao_id, data_inicio, data_fim) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_regras_comissao_profissional
  ON regras_comissao(profissional_id) WHERE profissional_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regras_comissao_servico
  ON regras_comissao(servico_id) WHERE servico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regras_comissao_produto
  ON regras_comissao(produto_id) WHERE produto_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. metas_comissao_faixas — faixas escalonadas (vinculadas a regra tipo='meta')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_comissao_faixas (
  id                 BIGSERIAL PRIMARY KEY,
  regra_id           BIGINT NOT NULL REFERENCES regras_comissao(id) ON DELETE CASCADE,
  ordem              INTEGER NOT NULL,
  faixa_inicio_cents INTEGER NOT NULL,
  faixa_fim_cents    INTEGER,
  percentual         NUMERIC(7,4) NOT NULL,
  modo               TEXT NOT NULL CHECK (modo IN ('progressivo','retroativo')),
  tipo_base          TEXT NOT NULL CHECK (tipo_base IN (
                       'faturamento_cents',
                       'quantidade_servicos',
                       'ticket_medio_cents',
                       'lucro_cents'
                     )),
  periodo            TEXT NOT NULL DEFAULT 'mensal' CHECK (periodo IN (
                       'mensal','semanal','quinzenal','personalizado'
                     )),

  CONSTRAINT faixa_fim_apos_inicio CHECK (
    faixa_fim_cents IS NULL OR faixa_fim_cents > faixa_inicio_cents
  ),
  CONSTRAINT faixa_percentual_range CHECK (percentual >= 0 AND percentual <= 100),

  UNIQUE (regra_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_metas_faixas_regra_ordem
  ON metas_comissao_faixas(regra_id, ordem);

-- ---------------------------------------------------------------------------
-- 3. comissoes — expansão de schema (NÃO remove colunas antigas)
-- ---------------------------------------------------------------------------
ALTER TABLE comissoes
  ADD COLUMN IF NOT EXISTS comanda_id              INTEGER,
  ADD COLUMN IF NOT EXISTS item_venda_id           INTEGER,
  ADD COLUMN IF NOT EXISTS cliente_id              INTEGER,
  ADD COLUMN IF NOT EXISTS servico_id              INTEGER,
  ADD COLUMN IF NOT EXISTS produto_id              INTEGER,
  ADD COLUMN IF NOT EXISTS tipo_item               TEXT,
  ADD COLUMN IF NOT EXISTS papel_profissional      TEXT NOT NULL DEFAULT 'principal',
  ADD COLUMN IF NOT EXISTS percentual_participacao NUMERIC(7,4) NOT NULL DEFAULT 100.0000,
  ADD COLUMN IF NOT EXISTS valor_bruto_cents       INTEGER,
  ADD COLUMN IF NOT EXISTS desconto_cents          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acrescimo_cents         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_cartao_cents       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_produto_cents     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_base_cents        INTEGER,
  ADD COLUMN IF NOT EXISTS valor_comissao_cents    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_fixo_cents        INTEGER,
  ADD COLUMN IF NOT EXISTS base_calculo            TEXT,
  ADD COLUMN IF NOT EXISTS regra_id                BIGINT REFERENCES regras_comissao(id),
  ADD COLUMN IF NOT EXISTS regra_snapshot_json     JSONB,
  ADD COLUMN IF NOT EXISTS status                  TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS motivo_bloqueio         TEXT,
  ADD COLUMN IF NOT EXISTS competencia             DATE,
  ADD COLUMN IF NOT EXISTS data_geracao            TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS pagamento_lote_id       BIGINT,
  ADD COLUMN IF NOT EXISTS origem                  TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS idempotency_key         TEXT,
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT NOW();

-- Constraints adicionais (depois das colunas existirem)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comissoes_status_check') THEN
    ALTER TABLE comissoes ADD CONSTRAINT comissoes_status_check CHECK (
      status IN ('pendente','paga','estornada','cancelada','bloqueada')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comissoes_papel_check') THEN
    ALTER TABLE comissoes ADD CONSTRAINT comissoes_papel_check CHECK (
      papel_profissional IN ('principal','assistente','vendedor','indicador','split')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comissoes_tipo_item_check') THEN
    ALTER TABLE comissoes ADD CONSTRAINT comissoes_tipo_item_check CHECK (
      tipo_item IS NULL OR tipo_item IN ('servico','produto','pacote','assinatura','interno')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comissoes_origem_check') THEN
    ALTER TABLE comissoes ADD CONSTRAINT comissoes_origem_check CHECK (
      origem IN ('automatica','manual','ajuste','migracao','recalculo')
    );
  END IF;
END $$;

-- Idempotência: garante que mesma (salao, key) nunca duplique
CREATE UNIQUE INDEX IF NOT EXISTS uq_comissoes_idempotency
  ON comissoes(salao_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Performance crítica
CREATE INDEX IF NOT EXISTS idx_comissoes_salao_status_competencia
  ON comissoes(salao_id, status, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_comissoes_profissional_status
  ON comissoes(profissional_id, status);
CREATE INDEX IF NOT EXISTS idx_comissoes_venda
  ON comissoes(venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_comanda
  ON comissoes(comanda_id) WHERE comanda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_pagamento_lote
  ON comissoes(pagamento_lote_id) WHERE pagamento_lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_regra
  ON comissoes(regra_id) WHERE regra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_competencia
  ON comissoes(salao_id, competencia DESC) WHERE competencia IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. comissoes_pagamentos_v2 — substitui/normaliza pagamentos antigos
-- ---------------------------------------------------------------------------
-- Mantém a tabela `comissoes_pagamentos` antiga intacta (já pode existir no
-- initDb.js); cria uma nova com schema completo. Endpoints v1 continuam
-- usando a antiga, v2 usa a nova.
CREATE TABLE IF NOT EXISTS comissoes_pagamentos_v2 (
  id                   BIGSERIAL PRIMARY KEY,
  salao_id             INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  profissional_id      INTEGER NOT NULL REFERENCES profissionais(id),

  valor_total_cents    INTEGER NOT NULL,
  quantidade_comissoes INTEGER NOT NULL DEFAULT 0,
  quantidade_ajustes   INTEGER NOT NULL DEFAULT 0,

  periodo_inicio       DATE NOT NULL,
  periodo_fim          DATE NOT NULL,

  status               TEXT NOT NULL DEFAULT 'pago' CHECK (
                         status IN ('pago','revertido','disputado')
                       ),
  observacao           TEXT,
  forma_pagamento      TEXT,
  idempotency_key      TEXT,

  criado_por           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revertido_em         TIMESTAMPTZ,
  revertido_por        TEXT,
  motivo_reversao      TEXT,

  CONSTRAINT pag_periodo_fim_apos_inicio CHECK (periodo_fim >= periodo_inicio),
  CONSTRAINT pag_valor_nao_negativo CHECK (valor_total_cents >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_v2_idempotency
  ON comissoes_pagamentos_v2(salao_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_v2_salao_prof_status
  ON comissoes_pagamentos_v2(salao_id, profissional_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_v2_periodo
  ON comissoes_pagamentos_v2(salao_id, periodo_inicio, periodo_fim);

-- FK back-reference: comissoes.pagamento_lote_id → comissoes_pagamentos_v2.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comissoes_pagamento_lote') THEN
    ALTER TABLE comissoes
      ADD CONSTRAINT fk_comissoes_pagamento_lote
      FOREIGN KEY (pagamento_lote_id) REFERENCES comissoes_pagamentos_v2(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. comissoes_ajustes — bônus, descontos, adiantamentos, correções, estornos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comissoes_ajustes (
  id                  BIGSERIAL PRIMARY KEY,
  salao_id            INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  profissional_id     INTEGER NOT NULL REFERENCES profissionais(id),

  tipo                TEXT NOT NULL CHECK (tipo IN (
                        'bonus','desconto','adiantamento','correcao','meta_retroativa','estorno'
                      )),
  valor_cents         INTEGER NOT NULL,  -- positivo (a pagar) ou negativo (descontar)
  motivo              TEXT NOT NULL,

  competencia         DATE,
  comissao_origem_id  BIGINT REFERENCES comissoes(id),
  pagamento_lote_id   BIGINT REFERENCES comissoes_pagamentos_v2(id) ON DELETE SET NULL,

  status              TEXT NOT NULL DEFAULT 'pendente' CHECK (
                        status IN ('pendente','aplicado','cancelado')
                      ),

  criado_por          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ajuste_motivo_nao_vazio CHECK (length(trim(motivo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ajustes_salao_prof_status
  ON comissoes_ajustes(salao_id, profissional_id, status);
CREATE INDEX IF NOT EXISTS idx_ajustes_competencia
  ON comissoes_ajustes(salao_id, competencia DESC) WHERE competencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ajustes_origem
  ON comissoes_ajustes(comissao_origem_id) WHERE comissao_origem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ajustes_lote
  ON comissoes_ajustes(pagamento_lote_id) WHERE pagamento_lote_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. BACKFILL legacy → v2
-- ---------------------------------------------------------------------------
-- Status: pago=true → 'paga', pago=false → 'pendente' (default já é 'pendente').
UPDATE comissoes
SET status = CASE WHEN pago = true THEN 'paga' ELSE 'pendente' END
WHERE status = 'pendente' AND pago IS NOT NULL;

-- Cents derivados dos campos DECIMAL antigos
UPDATE comissoes
SET valor_comissao_cents = ROUND(valor_comissao * 100)::int
WHERE valor_comissao_cents = 0 AND valor_comissao IS NOT NULL;

UPDATE comissoes
SET valor_base_cents = ROUND(valor_total * 100)::int,
    valor_bruto_cents = ROUND(valor_total * 100)::int
WHERE valor_base_cents IS NULL AND valor_total IS NOT NULL;

-- Competência: 1º dia do mês de created_at
UPDATE comissoes
SET competencia = DATE_TRUNC('month', created_at)::date
WHERE competencia IS NULL AND created_at IS NOT NULL;

-- Origem: marca registros antigos como migração
UPDATE comissoes
SET origem = 'migracao'
WHERE origem = 'manual' AND idempotency_key IS NULL;

-- Snapshot mínimo pra rastreabilidade
UPDATE comissoes
SET regra_snapshot_json = jsonb_build_object(
  'tipo', 'legacy',
  'percentual', percentual,
  'valor_total', valor_total,
  'valor_comissao', valor_comissao,
  'migrated_at', NOW()
)
WHERE regra_snapshot_json IS NULL;

-- ---------------------------------------------------------------------------
-- 7. Audit trail: trigger pra updated_at automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comissoes_updated_at ON comissoes;
CREATE TRIGGER trg_comissoes_updated_at
  BEFORE UPDATE ON comissoes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_regras_updated_at ON regras_comissao;
CREATE TRIGGER trg_regras_updated_at
  BEFORE UPDATE ON regras_comissao
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_ajustes_updated_at ON comissoes_ajustes;
CREATE TRIGGER trg_ajustes_updated_at
  BEFORE UPDATE ON comissoes_ajustes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- (sem COMMIT — runner faz)

-- ============================================================================
-- ROLLBACK (manual, executar SE necessário reverter):
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_comissoes_updated_at ON comissoes;
-- DROP TRIGGER IF EXISTS trg_regras_updated_at ON regras_comissao;
-- DROP TRIGGER IF EXISTS trg_ajustes_updated_at ON comissoes_ajustes;
-- DROP TABLE IF EXISTS comissoes_ajustes;
-- DROP TABLE IF EXISTS comissoes_pagamentos_v2;
-- DROP TABLE IF EXISTS metas_comissao_faixas;
-- DROP TABLE IF EXISTS regras_comissao;
-- -- Colunas em comissoes ficam (não removemos pra não perder dados de backfill)
-- COMMIT;
-- ============================================================================
