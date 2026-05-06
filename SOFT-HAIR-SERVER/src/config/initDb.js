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
  `);

  // Caixa diário
  await query(`
    CREATE TABLE IF NOT EXISTS caixa (
      id SERIAL PRIMARY KEY,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      saldo_inicial DECIMAL(10,2) DEFAULT 0,
      saldo_final DECIMAL(10,2),
      observacoes TEXT,
      aberto_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
      aberto_em TIMESTAMPTZ DEFAULT NOW(),
      fechado_em TIMESTAMPTZ
    )
  `);

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

  console.log('✅ Migrations aplicadas');
}

module.exports = { initDb, runMigrations };
