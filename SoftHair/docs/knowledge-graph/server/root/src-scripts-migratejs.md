# src/scripts/migrate.js

**Repository:** Server
**File:** `src/scripts/migrate.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/scripts/migrate.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

- [[server/entities/server-05c102bd|Server]]

## Arquivos Relacionados

- [[server/config/src-config-initdbjs|src/config/initDb.js]]
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
- [[server/root/src-serverjs|src/server.js]]

## Conteudo

```javascript
#!/usr/bin/env node

/**
 * Migration Runner — Executa migrações SQL em ordem
 * Rastreia quais migrações já foram executadas via tabela `migrations`.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(r => r.name);
}

async function runMigration(filename, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`  ✅ ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  ❌ ${filename}: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('🔄 Executando migrações...\n');

  try {
    await ensureMigrationsTable();
    const executed = await getExecutedMigrations();

    // Verificar se diretório existe
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
      console.log('📁 Diretório de migrações criado:', MIGRATIONS_DIR);
      console.log('ℹ️  Nenhuma migração para executar.\n');
      console.log('Para criar uma migração, crie um arquivo .sql em:');
      console.log(`  ${MIGRATIONS_DIR}/001_nome_da_migracao.sql\n`);
      await pool.end();
      return;
    }

    // Ler e ordenar arquivos de migração
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const pending = files.filter(f => !executed.includes(f));

    if (pending.length === 0) {
      console.log('✅ Todas as migrações já foram executadas.');
      console.log(`   Total: ${executed.length} migrações`);
    } else {
      console.log(`📋 ${pending.length} migração(ões) pendente(s):\n`);
      for (const file of pending) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await runMigration(file, sql);
      }
      console.log(`\n✅ ${pending.length} migração(ões) executada(s) com sucesso!`);
    }

    await pool.end();
  } catch (error) {
    console.error('\n❌ Erro na migração:', error.message);
    await pool.end();
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
```
