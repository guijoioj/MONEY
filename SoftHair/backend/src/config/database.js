/**
 * Database adapter — SQLite local OU PostgreSQL (Render).
 *
 * Controlado por env DATABASE_TYPE:
 *   - 'sqlite' (default): banco local em ./database/local.db
 *   - 'postgres': usa DATABASE_URL
 *
 * API unificada usa placeholders `?`. O adapter PostgreSQL converte
 * automaticamente para `$1, $2, ...` quando necessário.
 */

const path = require('path');
const fs = require('fs');

const dbType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();

let query, queryOne, queryRun, withTransaction, pool, rawClient;

function convertPlaceholders(sql) {
  // Converte `?` em `$1, $2, ...` para Postgres
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

if (dbType === 'postgres') {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
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
  withTransaction = async (fn) => {
    const trx = db.transaction(async () => {
      const wrapped = {
        query: async (sql, params = []) => {
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
};
