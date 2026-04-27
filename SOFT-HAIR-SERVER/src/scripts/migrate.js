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