/**
 * Inicialização de schema para SQLite local.
 *
 * Diferenças do PostgreSQL:
 *   - SERIAL → INTEGER PRIMARY KEY AUTOINCREMENT
 *   - TIMESTAMP / TIMESTAMPTZ → TEXT (ISO strings) com CURRENT_TIMESTAMP
 *   - BOOLEAN → INTEGER (0/1)
 *   - JSONB → TEXT (parse manual)
 *   - Sem triggers PL/pgSQL; updated_at é setado manualmente nos UPDATEs
 *
 * Quando rodando com DATABASE_TYPE=postgres (Render), esta função
 * vira no-op porque o schema é mantido pelo SOFT-HAIR-SERVER.
 */

const { dbType, rawClient } = require('./database');

function initDb() {
  if (dbType !== 'sqlite') {
    console.log('[initDb] DATABASE_TYPE=' + dbType + ' — schema gerenciado externamente. Skipping.');
    return;
  }

  console.log('[initDb] Inicializando schema SQLite...');

  const db = rawClient;
  const ddl = `
    CREATE TABLE IF NOT EXISTS saloes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      endereco TEXT,
      telefone TEXT,
      email TEXT,
      cnpj TEXT,
      logo_url TEXT,
      ativo INTEGER DEFAULT 1,
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT DEFAULT 'admin',
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      ativo INTEGER DEFAULT 1,
      ultimo_acesso TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      cpf TEXT,
      endereco TEXT,
      data_nascimento TEXT,
      observacoes TEXT,
      foto_url TEXT,
      credito_disponivel REAL DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS profissionais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      cpf TEXT,
      especialidade TEXT,
      comissao_percentual REAL DEFAULT 0,
      foto_url TEXT,
      ativo INTEGER DEFAULT 1,
      senha_hash TEXT,
      app_ativo INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL,
      duracao_minutos INTEGER,
      comissao_percentual REAL DEFAULT 0,
      cor TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco_custo REAL,
      preco_venda REAL NOT NULL,
      quantidade_estoque INTEGER DEFAULT 0,
      quantidade_minima INTEGER DEFAULT 0,
      categoria TEXT,
      codigo_barras TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
      servico_id INTEGER REFERENCES servicos(id) ON DELETE CASCADE,
      data_hora TEXT NOT NULL,
      duracao_minutos INTEGER,
      status TEXT DEFAULT 'agendado',
      observacoes TEXT,
      valor REAL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS atendimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      servico_id INTEGER REFERENCES servicos(id) ON DELETE SET NULL,
      agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,
      valor REAL DEFAULT 0,
      status TEXT DEFAULT 'em_andamento',
      observacoes TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
      tipo TEXT NOT NULL,
      status TEXT DEFAULT 'pendente',
      valor_total REAL NOT NULL,
      desconto REAL DEFAULT 0,
      valor_final REAL NOT NULL,
      forma_pagamento TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id) ON DELETE CASCADE,
      quantidade INTEGER NOT NULL,
      preco_unitario REAL NOT NULL,
      valor_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabela TEXT NOT NULL,
      operacao TEXT NOT NULL,
      registro_id INTEGER NOT NULL,
      dados TEXT,
      sync_timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_clientes_salao ON clientes(salao_id);
    CREATE INDEX IF NOT EXISTS idx_profissionais_salao ON profissionais(salao_id);
    CREATE INDEX IF NOT EXISTS idx_servicos_salao ON servicos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_produtos_salao ON produtos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_salao ON agendamentos(salao_id);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora);
    CREATE INDEX IF NOT EXISTS idx_vendas_salao ON vendas(salao_id);
    CREATE INDEX IF NOT EXISTS idx_atendimentos_salao ON atendimentos(salao_id);

    -- P4-C7: schema versioning + migrations infra
    -- Cada migration aplicada via migrations/<NNN>_descricao.sql é registrada aqui.
    -- Migration 0 = schema inicial (este DDL). Migrations futuras incrementam.
    CREATE TABLE IF NOT EXISTS schema_versions (
      version INTEGER PRIMARY KEY,
      description TEXT,
      applied_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `;

  db.exec(ddl);

  // P4-C7: garantir migration 0 (schema inicial) registrada
  try {
    db.prepare(`INSERT OR IGNORE INTO schema_versions (version, description) VALUES (0, 'schema inicial')`).run();
  } catch (_) { /* OK em DB já populado */ }

  console.log('[initDb] Schema SQLite pronto.');

  // P4-C7: aplica migrations pendentes (se diretório existir).
  // Cada migration em backend/src/migrations/NNN_descricao.sql é executada
  // dentro de transação, e o número da versão é registrado em schema_versions.
  // Antes de aplicar, faz backup automático do DB para .pre-migration-NNN.
  try {
    runPendingMigrations(db);
  } catch (e) {
    console.error('[initDb] Falha ao aplicar migrations pendentes:', e.message);
    // Não fail-fast: o app boota com schema antigo.
  }

  // Seed: salão default + admin se não existir
  // E4: NÃO criamos mais admin/admin123 default. Em vez disso:
  //   - se BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD estão setados, usamos
  //   - senão, criamos apenas o salão. O frontend deve oferecer setup wizard
  //     que cria o primeiro admin com senha forte do usuário (POST /api/auth/bootstrap-admin).
  // P3-C6: também valida `isStrongPassword` (não só `.length >= 8`).
  const bcrypt = require('bcryptjs');
  const { isStrongPassword } = require('../lib/passwords');
  const existing = db.prepare('SELECT COUNT(*) as n FROM saloes').get() || { n: 0 };
  if ((existing.n || 0) === 0) {
    const info = db.prepare(
      `INSERT INTO saloes (nome, email, ativo) VALUES (?, ?, 1)`
    ).run('Meu Salão', null);
    const salaoId = info.lastInsertRowid;

    console.log(`[initDb] Salão default criado (id=${salaoId})`);

    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (bootstrapEmail && bootstrapPassword) {
      // P3-C6: rejeitar senha fraca, mesmo via env. Senão, deixa para setup wizard.
      if (!isStrongPassword(bootstrapPassword)) {
        console.warn(
          '[initDb] BOOTSTRAP_ADMIN_PASSWORD não atende a política de senha forte ' +
          '(8+ chars, maiúscula, minúscula, dígito, não comum). ' +
          'Admin NÃO foi criado — use o setup wizard na UI.'
        );
      } else {
        const senhaHash = bcrypt.hashSync(bootstrapPassword, 10);
        db.prepare(
          `INSERT INTO usuarios (email, senha_hash, nome, tipo, salao_id, ativo)
           VALUES (?, ?, ?, 'admin', ?, 1)`
        ).run(bootstrapEmail, senhaHash, 'Administrador', salaoId);
        // E22/E20: nunca logar senha em plaintext, mesmo bootstrap.
        console.log(`[initDb] Admin bootstrap criado: ${bootstrapEmail}`);
      }
    } else {
      console.log('[initDb] Nenhum admin criado — use o setup wizard na UI para criar o primeiro admin.');
    }
  }
}

/**
 * P4-C7: aplica migrations SQL pendentes em ordem.
 *
 * Convenção:
 *   - Arquivos em backend/src/migrations/<NNN>_descricao.sql
 *   - NNN = inteiro 1+, zero-padded para sort estável (001, 002, ...)
 *   - Schema inicial registrado como version=0 em schema_versions.
 *
 * Antes de aplicar, faz cópia do DB para `local.db.pre-migration-<NNN>` para
 * rollback manual em caso de problema.
 */
function runPendingMigrations(db) {
  const path = require('path');
  const fs = require('fs');
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) return; // nenhuma migration definida

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => /^\d{3,}_.+\.sql$/.test(f))
    .sort();

  if (files.length === 0) return;

  // Versões já aplicadas
  const appliedRows = db.prepare(`SELECT version FROM schema_versions`).all();
  const applied = new Set(appliedRows.map((r) => Number(r.version)));

  for (const file of files) {
    const match = /^(\d{3,})_(.+)\.sql$/.exec(file);
    if (!match) continue;
    const version = Number(match[1]);
    const description = match[2].replace(/_/g, ' ');
    if (applied.has(version)) continue;

    console.log(`[initDb] Aplicando migration ${file}...`);

    // Backup pré-migration
    try {
      const dataDir = process.env.SOFTHAIR_DATA_DIR ||
        path.join(__dirname, '..', '..', 'database');
      const src = path.join(dataDir, 'local.db');
      const dest = path.join(dataDir, `local.db.pre-migration-${match[1]}`);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`[initDb] Backup pré-migration salvo em ${dest}`);
      }
    } catch (e) {
      console.warn('[initDb] Falha ao salvar backup pré-migration:', e.message);
      // Não aborta: prefere aplicar migration mesmo sem backup
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const txn = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO schema_versions (version, description) VALUES (?, ?)`).run(version, description);
    });
    try {
      txn();
      console.log(`[initDb] Migration ${version} aplicada: ${description}`);
    } catch (e) {
      console.error(`[initDb] FALHA na migration ${version}: ${e.message}`);
      throw e;
    }
  }
}

module.exports = { initDb, runPendingMigrations };
