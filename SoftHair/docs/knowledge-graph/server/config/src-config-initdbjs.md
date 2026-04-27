# src/config/initDb.js

**Repository:** Server
**File:** `src/config/initDb.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/config/initDb.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

- [[server/entities/database-da68fd18|Database]]
- [[server/entities/server-05c102bd|Server]]

## Arquivos Relacionados

- [[server/root/src-middleware-authjs|src/middleware/auth.js]]
- [[server/routes/src-routes-agendamentosjs|src/routes/agendamentos.js]]
- [[server/routes/src-routes-atendimentosjs|src/routes/atendimentos.js]]
- [[server/routes/src-routes-authjs|src/routes/auth.js]]
- [[server/routes/src-routes-clientesjs|src/routes/clientes.js]]
- [[server/routes/src-routes-comissoesjs|src/routes/comissoes.js]]
- [[server/routes/src-routes-creditosjs|src/routes/creditos.js]]
- [[server/routes/src-routes-fechamentosjs|src/routes/fechamentos.js]]
- [[server/routes/src-routes-healthjs|src/routes/health.js]]
- [[server/routes/src-routes-notificacoesjs|src/routes/notificacoes.js]]
- [[server/routes/src-routes-produtosjs|src/routes/produtos.js]]
- [[server/routes/src-routes-profissionaisjs|src/routes/profissionais.js]]
- [[server/routes/src-routes-saloesjs|src/routes/saloes.js]]
- [[server/routes/src-routes-servicosjs|src/routes/servicos.js]]
- [[server/routes/src-routes-syncjs|src/routes/sync.js]]
- [[server/routes/src-routes-vendasjs|src/routes/vendas.js]]
- [[server/root/src-scripts-migratejs|src/scripts/migrate.js]]
- [[server/root/src-serverjs|src/server.js]]

## Conteudo

```javascript
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

module.exports = { initDb };
```
