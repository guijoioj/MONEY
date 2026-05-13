/**
 * Database adapter — SQLite local OU PostgreSQL (Render).
 *
 * Controlado por env DATABASE_TYPE:
 *   - 'sqlite' (default): banco local em ./database/local.db
 *   - 'postgres': usa DATABASE_URL
 *
 * API unificada usa placeholders `?`. O adapter PostgreSQL converte
 * automaticamente para `$1, $2, ...` quando necessário.
 *
 * Pass 1 fixes:
 *   - E3: default `rejectUnauthorized: true` para Postgres SSL; usuário
 *         deve setar DATABASE_SSL=insecure para reverter.
 *   - E10: regex de placeholders agora respeita string literals.
 *   - E30: withTransaction SQLite usa callback síncrono.
 */

const path = require('path');
const fs = require('fs');

const dbType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();

let query, queryOne, queryRun, withTransaction, pool, rawClient;

// E10: converte `?` em `$N` para Postgres ignorando ? dentro de strings literais.
// O parser percorre a string mantendo controle se estamos dentro de aspas simples
// ou duplas. `'don''t'` é tratado pelo SQL como escape e funciona porque os ?
// que importam estão fora dele.
function convertPlaceholders(sql) {
  let out = '';
  let count = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (inLineComment) {
      out += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      out += ch;
      if (ch === '*' && next === '/') { out += '/'; i++; inBlockComment = false; }
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === '-' && next === '-') { out += '--'; i++; inLineComment = true; continue; }
      if (ch === '/' && next === '*') { out += '/*'; i++; inBlockComment = true; continue; }
    }
    if (!inDouble && ch === "'") { inSingle = !inSingle; out += ch; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; continue; }
    if (!inSingle && !inDouble && ch === '?') {
      out += `$${++count}`;
      continue;
    }
    out += ch;
  }
  return out;
}

if (dbType === 'postgres') {
  const { Pool } = require('pg');
  // E3: padrão seguro — rejectUnauthorized:true. Usuário precisa setar
  // explicitamente DATABASE_SSL=insecure para aceitar cert inválido (legacy).
  let sslOpt;
  const sslEnv = (process.env.DATABASE_SSL || '').toLowerCase();
  if (sslEnv === 'false' || sslEnv === 'off' || sslEnv === '0') {
    sslOpt = false;
  } else if (sslEnv === 'insecure') {
    sslOpt = { rejectUnauthorized: false };
  } else {
    // default seguro
    sslOpt = { rejectUnauthorized: true };
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslOpt,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => console.error('[DB] Postgres pool error:', err.message));

  query = async (sql, params = []) => {
    const pgSql = sql.includes('?') ? convertPlaceholders(sql) : sql;
    const r = await pool.query(pgSql, params);
    return r.rows;
  };
  queryOne = async (sql, params = []) => {
    const pgSql = sql.includes('?') ? convertPlaceholders(sql) : sql;
    const r = await pool.query(pgSql, params);
    return r.rows[0] || null;
  };
  queryRun = async (sql, params = []) => {
    const pgSql = sql.includes('?') ? convertPlaceholders(sql) : sql;
    const r = await pool.query(pgSql, params);
    return { rowCount: r.rowCount, rows: r.rows, lastInsertRowid: r.rows?.[0]?.id };
  };
  withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wrapped = {
        query: async (sql, params = []) => {
          const pgSql = sql.includes('?') ? convertPlaceholders(sql) : sql;
          return client.query(pgSql, params);
        },
      };
      const result = await fn(wrapped);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
  rawClient = pool;
} else {
  // SQLite
  const Database = require('better-sqlite3');

  const dataDir = process.env.SOFTHAIR_DATA_DIR ||
    path.join(__dirname, '..', '..', 'database');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'local.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log(`[DB] SQLite ativo em ${dbPath}`);

  query = (sql, params = []) => {
    try {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    } catch (e) {
      // Statement que não retorna rows (INSERT/UPDATE/DELETE) — usar run
      if (e.message.includes('not return data')) {
        const stmt = db.prepare(sql);
        const info = stmt.run(...params);
        return [];
      }
      throw e;
    }
  };
  queryOne = (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  };
  queryRun = (sql, params = []) => {
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return { rowCount: info.changes, rows: [], lastInsertRowid: info.lastInsertRowid };
  };
  // E30: callback síncrono dentro de db.transaction (better-sqlite3 é síncrono).
  // Qualquer async dentro de `fn` é uma violação documentada — para ops mistas,
  // colete async fora da transação.
  withTransaction = async (fn) => {
    const trx = db.transaction(() => {
      const wrapped = {
        query: (sql, params = []) => {
          try {
            const stmt = db.prepare(sql);
            const rows = stmt.all(...params);
            return { rows, rowCount: rows.length };
          } catch (e) {
            if (e.message.includes('not return data')) {
              const stmt = db.prepare(sql);
              const info = stmt.run(...params);
              return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
            }
            throw e;
          }
        },
      };
      return fn(wrapped);
    });
    return trx();
  };
  rawClient = db;
  pool = null;
}

module.exports = {
  dbType,
  query,
  queryOne,
  queryRun,
  withTransaction,
  pool,
  rawClient,
  // exportado para testes do parser (E10)
  _convertPlaceholders: convertPlaceholders,
};
