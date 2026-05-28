const { pool, query } = require('./database');
const fs = require('fs');
const path = require('path');

async function initDb() {
  console.log('🔧 Inicializando banco de dados centralizado...');

  try {
    // Create tables
    await createTables();

    // Create indexes
    await createIndexes();

    // Create functions
    await createFunctions();

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

async function createTables() {
  const sql = `
    -- Salões (Tenants)
    CREATE TABLE IF NOT EXISTS saloes (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      endereco TEXT,
      telefone VARCHAR(50),
      email VARCHAR(255),
      cnpj VARCHAR(20),
      logo_url TEXT,
      ativo BOOLEAN DEFAULT true,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Usuários (Admins do sistema)
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      tipo VARCHAR(50) DEFAULT 'admin',
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      ativo BOOLEAN DEFAULT true,
      ultimo_acesso TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Clientes
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome VARCHAR(255) NOT NULL,
      telefone VARCHAR(50),
      email VARCHAR(255),
      cpf VARCHAR(20),
      endereco TEXT,
      data_nascimento DATE,
      observacoes TEXT,
      foto_url TEXT,
      credito_disponivel DECIMAL(10,2) DEFAULT 0,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Clientes app (compatibilidade; dados reais ficam em clientes)
    CREATE TABLE IF NOT EXISTS clientes_app (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      telefone VARCHAR(50),
      foto TEXT,
      push_token TEXT,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Profissionais
    CREATE TABLE IF NOT EXISTS profissionais (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome VARCHAR(255) NOT NULL,
      telefone VARCHAR(50),
      email VARCHAR(255),
      cpf VARCHAR(20),
      especialidade VARCHAR(255),
      comissao_percentual DECIMAL(5,2) DEFAULT 0,
      foto_url TEXT,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Serviços
    CREATE TABLE IF NOT EXISTS servicos (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      preco DECIMAL(10,2) NOT NULL,
      duracao_minutos INTEGER,
      comissao_percentual DECIMAL(5,2) DEFAULT 0,
      cor VARCHAR(20),
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Produtos
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      preco_custo DECIMAL(10,2),
      preco_venda DECIMAL(10,2) NOT NULL,
      quantidade_estoque INTEGER DEFAULT 0,
      quantidade_minima INTEGER DEFAULT 0,
      categoria VARCHAR(100),
      codigo_barras VARCHAR(100),
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Agendamentos
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      servico_id INTEGER REFERENCES servicos(id) ON DELETE CASCADE,
      data_hora TIMESTAMP NOT NULL,
      duracao_minutos INTEGER,
      status VARCHAR(50) DEFAULT 'agendado',
      observacoes TEXT,
      valor DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Pedidos de agendamento do app
    CREATE TABLE IF NOT EXISTS pedidos_agendamento (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_app_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      servico_id INTEGER REFERENCES servicos(id) ON DELETE SET NULL,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      data_desejada DATE NOT NULL,
      horario_desejado TIME NOT NULL,
      horario_alternativo TIME,
      observacoes TEXT,
      status VARCHAR(50) DEFAULT 'pendente',
      agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,
      atendido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      motivo_rejeicao TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Atendimentos
    CREATE TABLE IF NOT EXISTS atendimentos (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      agendamento_id INTEGER,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      servico_id INTEGER REFERENCES servicos(id) ON DELETE SET NULL,
      data_atendimento DATE,
      status VARCHAR(50) DEFAULT 'finalizado',
      observacoes TEXT,
      valor DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Vendas
    CREATE TABLE IF NOT EXISTS vendas (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      tipo VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pendente',
      valor_total DECIMAL(10,2) NOT NULL,
      desconto DECIMAL(10,2) DEFAULT 0,
      valor_final DECIMAL(10,2) NOT NULL,
      forma_pagamento VARCHAR(50),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Itens de Venda
    CREATE TABLE IF NOT EXISTS venda_itens (
      id SERIAL PRIMARY KEY,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id) ON DELETE CASCADE,
      quantidade INTEGER NOT NULL,
      preco_unitario DECIMAL(10,2) NOT NULL,
      valor_total DECIMAL(10,2) NOT NULL
    );

    -- Pedidos de loja do app
    CREATE TABLE IF NOT EXISTS pedidos_loja (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_app_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'pendente',
      total DECIMAL(10,2) DEFAULT 0,
      endereco_entrega TEXT,
      forma_pagamento VARCHAR(50),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pedido_loja_itens (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER REFERENCES pedidos_loja(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
      quantidade INTEGER NOT NULL,
      preco_unitario DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL
    );

    -- Comissões
    CREATE TABLE IF NOT EXISTS comissoes (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
      valor_total DECIMAL(10,2) NOT NULL,
      percentual DECIMAL(5,2) NOT NULL,
      valor_comissao DECIMAL(10,2) NOT NULL,
      pago BOOLEAN DEFAULT false,
      data_pagamento DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comissoes_pagamentos (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      valor DECIMAL(10,2) NOT NULL,
      data_pagamento DATE DEFAULT CURRENT_DATE,
      observacoes TEXT,
      motivo_estorno TEXT,
      status VARCHAR(50) DEFAULT 'pago',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Fechamentos
    CREATE TABLE IF NOT EXISTS fechamentos (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      total_vendas DECIMAL(10,2) DEFAULT 0,
      total_servicos DECIMAL(10,2) DEFAULT 0,
      total_produtos DECIMAL(10,2) DEFAULT 0,
      total_comissoes DECIMAL(10,2) DEFAULT 0,
      total_liquido DECIMAL(10,2) DEFAULT 0,
      observacoes TEXT,
      status VARCHAR(50) DEFAULT 'aberto',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Créditos de Clientes
    CREATE TABLE IF NOT EXISTS creditos_cliente (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      saldo_anterior DECIMAL(10,2) NOT NULL,
      saldo_novo DECIMAL(10,2) NOT NULL,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notificações
    CREATE TABLE IF NOT EXISTS notificacoes (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      titulo VARCHAR(255) NOT NULL,
      mensagem TEXT NOT NULL,
      destinatario_id INTEGER,
      destinatario_tipo VARCHAR(50),
      lida BOOLEAN DEFAULT false,
      data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Sync Log (para sincronização com clientes)
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      tabela VARCHAR(100) NOT NULL,
      operacao VARCHAR(20) NOT NULL,
      registro_id INTEGER NOT NULL,
      dados JSONB,
      sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      client_synced BOOLEAN DEFAULT false
    );

    -- Devices (para autenticação de clientes)
    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      nome VARCHAR(255),
      fingerprint VARCHAR(255) UNIQUE,
      info JSONB,
      ativo BOOLEAN DEFAULT true,
      ultimo_acesso TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- API Keys
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      chave VARCHAR(255) UNIQUE NOT NULL,
      nome VARCHAR(255),
      permissoes JSONB DEFAULT '[]',
      ativo BOOLEAN DEFAULT true,
      ultimo_uso TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS registros_ponto (
      id SERIAL PRIMARY KEY,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      chave VARCHAR(255) NOT NULL,
      valor TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (salao_id, chave)
    );

    CREATE TABLE IF NOT EXISTS produtos_utilizados (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      agendamento_id INTEGER,
      produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
      cliente_id INTEGER,
      cliente_nome VARCHAR(255),
      marca VARCHAR(255),
      coloracao VARCHAR(255),
      quantidade DECIMAL DEFAULT 1,
      observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_mensagens (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      remetente_id INTEGER NOT NULL,
      remetente_tipo VARCHAR(20) NOT NULL,
      destinatario_id INTEGER,
      destinatario_tipo VARCHAR(20),
      mensagem TEXT NOT NULL,
      lida BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bloqueios_horario (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      data_inicio TIMESTAMPTZ NOT NULL,
      data_fim TIMESTAMPTZ NOT NULL,
      motivo TEXT DEFAULT 'Bloqueado',
      dia_inteiro BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS despesas (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      descricao TEXT NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      categoria VARCHAR(100) DEFAULT 'Outros',
      data DATE DEFAULT CURRENT_DATE,
      recorrente BOOLEAN DEFAULT FALSE,
      observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- [P5-C2] Audit log persistente — forense queryable de ações sensíveis
    -- [P6-C2] Append-only + hash chain (previous_hash, current_hash) para detectar tampering
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER,
      actor_id INTEGER,
      actor_type VARCHAR(20),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id INTEGER,
      before_data JSONB,
      after_data JSONB,
      ip VARCHAR(45),
      user_agent TEXT,
      previous_hash VARCHAR(64),
      current_hash VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_salao_created ON audit_log(salao_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);

    -- [P5-A3] UNIQUE constraint para evitar duplicatas de cliente_app por race condition
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_clientes_app_email'
      ) THEN
        BEGIN
          ALTER TABLE clientes_app ADD CONSTRAINT uq_clientes_app_email UNIQUE (email);
        EXCEPTION WHEN unique_violation OR duplicate_object THEN NULL;
        END;
      END IF;
    END $$;

    -- [P6-C3] UNIQUE em clientes(salao_id, LOWER(email)) — appAuth.js insere aqui,
    -- não em clientes_app. P5-A3 estava aplicado na tabela errada.
    -- 1) Deduplicar: manter o mais antigo por (salao_id, LOWER(email))
    DO $$
    BEGIN
      DELETE FROM clientes a USING clientes b
        WHERE a.id > b.id
          AND a.email IS NOT NULL
          AND b.email IS NOT NULL
          AND LOWER(a.email) = LOWER(b.email)
          AND COALESCE(a.salao_id, 0) = COALESCE(b.salao_id, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'P6-C3 dedup clientes: % (continuando)', SQLERRM;
    END $$;
  `;

  await query(sql);
  console.log('✅ Tabelas criadas');
}

async function createIndexes() {
  const indexes = `
    CREATE INDEX IF NOT EXISTS idx_clientes_salao ON clientes(salao_id);
    CREATE INDEX IF NOT EXISTS idx_profissionais_salao ON profissionais(salao_id);
    CREATE INDEX IF NOT EXISTS idx_servicos_salao ON servicos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_produtos_salao ON produtos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_salao ON agendamentos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora);
    CREATE INDEX IF NOT EXISTS idx_vendas_salao ON vendas(salao_id);
    CREATE INDEX IF NOT EXISTS idx_sync_log_salao ON sync_log(salao_id, client_synced);
  `;

  await query(indexes);
  console.log('✅ Índices criados');
}

async function createFunctions() {
  const functions = `
    -- Função para atualizar updated_at
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Trigger para atualizar updated_at em todas as tabelas
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_saloes_updated_at') THEN
        CREATE TRIGGER trg_saloes_updated_at BEFORE UPDATE ON saloes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clientes_updated_at') THEN
        CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profissionais_updated_at') THEN
        CREATE TRIGGER trg_profissionais_updated_at BEFORE UPDATE ON profissionais
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_servicos_updated_at') THEN
        CREATE TRIGGER trg_servicos_updated_at BEFORE UPDATE ON servicos
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_produtos_updated_at') THEN
        CREATE TRIGGER trg_produtos_updated_at BEFORE UPDATE ON produtos
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;

    -- Função para log de sync
    CREATE OR REPLACE FUNCTION log_sync()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO sync_log (salao_id, tabela, operacao, registro_id, dados)
      VALUES (
        NEW.salao_id,
        TG_TABLE_NAME,
        TG_OP,
        NEW.id,
        row_to_json(NEW)
      );
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;

  await query(functions);
  console.log('✅ Funções criadas');
}

async function runMigrations() {
  await query(`
    ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS auxiliar_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL;
    ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMP;
    ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
    ALTER TABLE creditos_cliente ADD COLUMN IF NOT EXISTS salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS app_ativo BOOLEAN DEFAULT false;
    ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);
    ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS app_ativo BOOLEAN DEFAULT false;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS push_token TEXT;
    ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS push_token TEXT;
    ALTER TABLE servicos ADD COLUMN IF NOT EXISTS cor VARCHAR(7) DEFAULT '#6366f1';
    -- [P6-M2] token_version: incrementado a cada troca de senha. Middleware compara
    -- com decoded.tokenVersion no JWT — se divergir, token é considerado revogado.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
    ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

    -- Sistema de Perfis (admin/recepcao/profissional)
    -- 'tipo' já existia com default 'admin' — agora aceita 3 valores.
    -- profissional_id liga o usuário a um profissional físico (apenas para tipo='profissional').
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL;
    -- Constraint para garantir somente roles válidas (tolera valores legados).
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_tipo_check'
      ) THEN
        ALTER TABLE usuarios
          ADD CONSTRAINT usuarios_tipo_check
          CHECK (tipo IN ('admin','recepcao','profissional'));
      END IF;
    EXCEPTION
      WHEN check_violation THEN
        -- Há linhas com valores antigos. Promove tudo que não bate para 'admin' e tenta de novo.
        UPDATE usuarios SET tipo='admin' WHERE tipo NOT IN ('admin','recepcao','profissional');
        ALTER TABLE usuarios
          ADD CONSTRAINT usuarios_tipo_check
          CHECK (tipo IN ('admin','recepcao','profissional'));
    END $$;
    CREATE INDEX IF NOT EXISTS idx_usuarios_profissional_id ON usuarios(profissional_id);
    CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo);

    -- Atendimentos: status do fluxo aberto.
    ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS observacoes TEXT;
    ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMP;
    -- Agendamentos: link com atendimento (após converter).
    ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS atendimento_id INTEGER REFERENCES atendimentos(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_agendamentos_atendimento_id ON agendamentos(atendimento_id);

    -- Itens do atendimento em aberto: snapshot de nome/preço/comissão preservado.
    -- Schema legado SQLite (text IDs, camelCase) é detectado e descartado.
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'atendimentos_servicos') THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_name = 'atendimentos_servicos' AND column_name = 'atendimento_id'
        ) THEN
          DROP TABLE atendimentos_servicos CASCADE;
        END IF;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS atendimentos_servicos (
      id              SERIAL PRIMARY KEY,
      atendimento_id  INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
      servico_id      INTEGER REFERENCES servicos(id) ON DELETE SET NULL,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      salao_id        INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
      nome_snapshot   TEXT NOT NULL,
      valor_snapshot  DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantidade      INTEGER NOT NULL DEFAULT 1,
      subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
      percentual_comissao_snapshot DECIMAL(5,2) DEFAULT 0,
      valor_comissao  DECIMAL(10,2) DEFAULT 0,
      observacao      TEXT,
      criado_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_atend_servicos_atend ON atendimentos_servicos(atendimento_id);
    CREATE INDEX IF NOT EXISTS idx_atend_servicos_salao ON atendimentos_servicos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_atend_servicos_prof  ON atendimentos_servicos(profissional_id);

    -- atendimentos_produtos: tabela legada era camelCase/TEXT. Se for o caso, dropa
    -- e recria em snake_case/INTEGER no mesmo estilo de atendimentos_servicos.
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'atendimentos_produtos') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'atendimentos_produtos' AND column_name = 'atendimentoId') THEN
          DROP TABLE atendimentos_produtos CASCADE;
        END IF;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS atendimentos_produtos (
      id              SERIAL PRIMARY KEY,
      atendimento_id  INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
      produto_id      INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
      salao_id        INTEGER NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
      nome_snapshot   TEXT NOT NULL,
      quantidade_usada DECIMAL(10,3) NOT NULL DEFAULT 1,
      unidade         TEXT DEFAULT 'un',
      preco_unitario  DECIMAL(10,2) NOT NULL DEFAULT 0,
      subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
      criado_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_atend_produtos_atend ON atendimentos_produtos(atendimento_id);
    CREATE INDEX IF NOT EXISTS idx_atend_produtos_salao ON atendimentos_produtos(salao_id);

    -- Atendimento: hora de início/fim (TIME) e desconto. data_atendimento já existe.
    ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS hora_inicio TIME;
    ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS hora_fim TIME;
    ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS desconto DECIMAL(10,2) DEFAULT 0;

    -- Audit log: usa a tabela audit_log singular que ja existe (schema com hash chain).
    -- utils/auditLog.js insere em audit_log. Removida criacao duplicada de audit_logs.
    CREATE INDEX IF NOT EXISTS idx_audit_log_salao_created
      ON audit_log(salao_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity
      ON audit_log(entity_type, entity_id);

    -- Normaliza vendas legadas: 'concluida'/'finalizada' → 'paga' (idempotente).
    -- Roda 1x por boot; após primeira execução nenhuma linha é tocada.
    UPDATE vendas SET status = 'paga' WHERE status IN ('concluida', 'finalizada');

    -- Histórico de backups (manual + automático diário).
    CREATE TABLE IF NOT EXISTS backups (
      id              BIGSERIAL PRIMARY KEY,
      salao_id        INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      tipo            VARCHAR(20) DEFAULT 'manual',
      status          VARCHAR(20) DEFAULT 'pending',
      tamanho_bytes   BIGINT,
      checksum        VARCHAR(64),
      dump_data       BYTEA,
      erro            TEXT,
      criado_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_backups_salao_created ON backups(salao_id, created_at DESC);
    -- Mirror externo (S3/R2/B2) preenchido por tools/sync-backups-external.js.
    ALTER TABLE backups ADD COLUMN IF NOT EXISTS arquivo_externo_url TEXT;

    -- Fechamento POR CLIENTE (caixa do cliente). data_inicio/data_fim já existem.
    ALTER TABLE fechamentos ALTER COLUMN data_inicio DROP NOT NULL;
    ALTER TABLE fechamentos ALTER COLUMN data_fim DROP NOT NULL;
    ALTER TABLE fechamentos ALTER COLUMN tipo DROP NOT NULL;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(50);
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS desconto_geral DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS credito_utilizado DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS total_atendimentos DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS total_geral DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS atendimento_ids INTEGER[];
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS venda_ids INTEGER[];
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS data DATE DEFAULT CURRENT_DATE;
    CREATE INDEX IF NOT EXISTS idx_fechamentos_cliente ON fechamentos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_fechamentos_data ON fechamentos(data);
  `);

  // Caixa diário
  await query(`
    CREATE TABLE IF NOT EXISTS caixa (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      saldo_inicial DECIMAL(10,2) DEFAULT 0,
      saldo_final DECIMAL(10,2),
      observacoes TEXT,
      aberto_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      aberto_em TIMESTAMPTZ DEFAULT NOW(),
      fechado_em TIMESTAMPTZ
    )
  `);

  // [P8-M1] UNIQUE partial index: 1 único caixa aberto por dia por salão.
  // Permite múltiplos caixas no mesmo dia se já fechados (fechamento + reabertura).
  // Fecha a janela de race em READ COMMITTED do INSERT...WHERE NOT EXISTS em /caixa/abrir.
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unq_caixa_salao_dia_aberto
      ON caixa(salao_id, ((aberto_em AT TIME ZONE 'UTC')::date))
      WHERE fechado_em IS NULL;
  `).catch((e) => {
    console.warn('[P8-M1] unique index caixa falhou (provavelmente duplicatas restantes):', e.message);
  });

  // Metas por profissional
  await query(`
    CREATE TABLE IF NOT EXISTS metas_profissional (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      mes INTEGER NOT NULL,
      ano INTEGER NOT NULL,
      meta_valor DECIMAL(10,2) DEFAULT 0,
      meta_atendimentos INTEGER DEFAULT 0,
      UNIQUE(salao_id, profissional_id, mes, ano)
    )
  `);

  // Programa de pontos/fidelidade
  await query(`
    CREATE TABLE IF NOT EXISTS pontos_fidelidade (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      pontos INTEGER NOT NULL DEFAULT 0,
      tipo VARCHAR(50) NOT NULL,
      descricao TEXT,
      referencia_id INTEGER,
      referencia_tipo VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pontos_cliente ON pontos_fidelidade(cliente_id, salao_id);
  `);

  // [P5-A5] Tabela dedicada para histórico de cliente (substitui pollution em agendamentos)
  await query(`
    CREATE TABLE IF NOT EXISTS historico_cliente (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      descricao TEXT NOT NULL,
      entidade_id INTEGER,
      data TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_historico_cliente_cliente ON historico_cliente(cliente_id, salao_id);
    CREATE INDEX IF NOT EXISTS idx_historico_cliente_data ON historico_cliente(salao_id, created_at DESC);
  `);

  // [P5-C5] Fechamentos: adicionar campos para soft-delete + motivo de reabertura
  await query(`
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS deleted_by INTEGER;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS motivo_delete TEXT;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS motivo_reabertura TEXT;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS reaberto_por INTEGER;
    ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS reaberto_em TIMESTAMPTZ;
    ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  `);

  // [P6-C3] UNIQUE clientes(salao_id, LOWER(email)) WHERE email IS NOT NULL
  await query(`
    DO $$
    BEGIN
      -- Dedup defensiva caso ainda haja duplicatas no DB live
      DELETE FROM clientes a USING clientes b
        WHERE a.id > b.id
          AND a.email IS NOT NULL
          AND b.email IS NOT NULL
          AND LOWER(a.email) = LOWER(b.email)
          AND COALESCE(a.salao_id, 0) = COALESCE(b.salao_id, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'P6-C3 dedup clientes runtime: % (continuando)', SQLERRM;
    END $$;
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unq_clientes_salao_email
      ON clientes(salao_id, LOWER(email)) WHERE email IS NOT NULL;
  `).catch((e) => {
    console.warn('[P6-C3] unique index falhou (provavelmente duplicatas restantes):', e.message);
  });

  // [P6-C2] Audit log append-only + hash chain
  // - Adiciona colunas previous_hash/current_hash (idempotente)
  // - Cria trigger BEFORE UPDATE/DELETE que RAISE EXCEPTION
  // - Trigger BEFORE INSERT que calcula current_hash = sha256(prev || canonical_row)
  await query(`
    ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
    ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);
  `);
  await query(`
    DO $$
    BEGIN
      -- Função que bloqueia UPDATE/DELETE
      CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS TRIGGER AS $f$
      BEGIN
        RAISE EXCEPTION 'audit_log é append-only — UPDATE/DELETE proibido';
      END;
      $f$ LANGUAGE plpgsql;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'P6-C2 immutable function: % (continuando)', SQLERRM;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_log_no_update') THEN
        CREATE TRIGGER trg_audit_log_no_update BEFORE UPDATE ON audit_log
          FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_log_no_delete') THEN
        CREATE TRIGGER trg_audit_log_no_delete BEFORE DELETE ON audit_log
          FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'P6-C2 triggers: % (continuando)', SQLERRM;
    END $$;
  `);
  // Hash chain trigger BEFORE INSERT
  await query(`
    DO $$
    BEGIN
      CREATE OR REPLACE FUNCTION audit_log_hash_chain() RETURNS TRIGGER AS $f$
      DECLARE
        prev_hash TEXT;
        canonical TEXT;
      BEGIN
        SELECT current_hash INTO prev_hash
          FROM audit_log
          ORDER BY id DESC LIMIT 1;
        NEW.previous_hash := COALESCE(prev_hash, '');
        canonical := COALESCE(NEW.previous_hash, '') || '|' ||
                     COALESCE(NEW.salao_id::TEXT, '') || '|' ||
                     COALESCE(NEW.actor_id::TEXT, '') || '|' ||
                     COALESCE(NEW.actor_type, '') || '|' ||
                     COALESCE(NEW.action, '') || '|' ||
                     COALESCE(NEW.entity_type, '') || '|' ||
                     COALESCE(NEW.entity_id::TEXT, '') || '|' ||
                     COALESCE(NEW.before_data::TEXT, '') || '|' ||
                     COALESCE(NEW.after_data::TEXT, '') || '|' ||
                     COALESCE(NEW.ip, '') || '|' ||
                     COALESCE(NEW.user_agent, '');
        NEW.current_hash := encode(digest(canonical, 'sha256'), 'hex');
        RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'P6-C2 hash chain function: % (continuando)', SQLERRM;
    END $$;
  `);
  // pgcrypto extension may be required for digest()
  await query(`
    DO $$
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pgcrypto extension: % (continuando)', SQLERRM;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_log_hash_chain') THEN
        CREATE TRIGGER trg_audit_log_hash_chain BEFORE INSERT ON audit_log
          FOR EACH ROW EXECUTE FUNCTION audit_log_hash_chain();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'P6-C2 hash chain trigger: % (continuando)', SQLERRM;
    END $$;
  `);

  // [P5-C1] Trocar CASCADE → RESTRICT/SET NULL em FKs financeiras (preserva histórico)
  // Idempotente: drop + recreate constraint só altera política, nada é apagado.
  await query(`
    DO $$
    BEGIN
      -- comissoes.profissional_id: histórico append-only → SET NULL (preserva valor pago)
      IF EXISTS (SELECT 1 FROM information_schema.referential_constraints
                 WHERE constraint_name = 'comissoes_profissional_id_fkey' AND delete_rule = 'CASCADE') THEN
        ALTER TABLE comissoes DROP CONSTRAINT comissoes_profissional_id_fkey;
        ALTER TABLE comissoes ADD CONSTRAINT comissoes_profissional_id_fkey
          FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE SET NULL;
      END IF;

      -- comissoes.venda_id: histórico append-only → SET NULL
      IF EXISTS (SELECT 1 FROM information_schema.referential_constraints
                 WHERE constraint_name = 'comissoes_venda_id_fkey' AND delete_rule = 'CASCADE') THEN
        ALTER TABLE comissoes DROP CONSTRAINT comissoes_venda_id_fkey;
        ALTER TABLE comissoes ADD CONSTRAINT comissoes_venda_id_fkey
          FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE SET NULL;
      END IF;

      -- venda_itens.produto_id: histórico append-only → SET NULL
      IF EXISTS (SELECT 1 FROM information_schema.referential_constraints
                 WHERE constraint_name = 'venda_itens_produto_id_fkey' AND delete_rule = 'CASCADE') THEN
        ALTER TABLE venda_itens DROP CONSTRAINT venda_itens_produto_id_fkey;
        ALTER TABLE venda_itens ADD CONSTRAINT venda_itens_produto_id_fkey
          FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL;
      END IF;

      -- atendimentos.cliente/profissional/servico já são SET NULL em initDb (linhas 176-178)

      -- comissoes_pagamentos.profissional_id → SET NULL (preserva evidência de pagamento)
      IF EXISTS (SELECT 1 FROM information_schema.referential_constraints
                 WHERE constraint_name = 'comissoes_pagamentos_profissional_id_fkey' AND delete_rule = 'CASCADE') THEN
        ALTER TABLE comissoes_pagamentos DROP CONSTRAINT comissoes_pagamentos_profissional_id_fkey;
        ALTER TABLE comissoes_pagamentos ADD CONSTRAINT comissoes_pagamentos_profissional_id_fkey
          FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE SET NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Tolerância: tabelas/constraints podem não existir em ambientes mais antigos
      RAISE NOTICE 'P5-C1 migration: % (continuando)', SQLERRM;
    END $$;
  `);

  // ---------------------------------------------------------------------------
  // Aplica migrations versionadas (.sql files) — banco limpo ganha V2 no boot
  // ---------------------------------------------------------------------------
  await applySqlMigrations();

  console.log('✅ Migrations aplicadas');
}

async function applySqlMigrations() {
  const fs = require('fs');
  const path = require('path');
  const dir = path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(dir)) return;

  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const rows = await query('SELECT name FROM migrations');
  const executed = new Set(rows.map(r => r.name));

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const pending = files.filter(f => !executed.has(f));
  if (pending.length === 0) return;

  console.log(`🔄 Aplicando ${pending.length} migration(s) SQL: ${pending.join(', ')}`);
  const { pool } = require('./database');
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✅ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ❌ ${file}: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = { initDb, runMigrations };
