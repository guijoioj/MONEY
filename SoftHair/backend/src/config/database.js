const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração SSL - só ativa em produção ou quando explicitamente configurado
let sslConfig = false;

if (process.env.DATABASE_SSL === 'true') {
  try {
    sslConfig = {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    };

    // Só tenta carregar certificados se os caminhos estiverem definidos
    if (process.env.DB_SSL_CA && fs.existsSync(process.env.DB_SSL_CA)) {
      sslConfig.ca = fs.readFileSync(process.env.DB_SSL_CA).toString();
    }
    if (process.env.DB_SSL_CERT && fs.existsSync(process.env.DB_SSL_CERT)) {
      sslConfig.cert = fs.readFileSync(process.env.DB_SSL_CERT).toString();
    }
    if (process.env.DB_SSL_KEY && fs.existsSync(process.env.DB_SSL_KEY)) {
      sslConfig.key = fs.readFileSync(process.env.DB_SSL_KEY).toString();
    }
  } catch (error) {
    console.warn('⚠️  Erro ao configurar SSL:', error.message);
    console.warn('   Continuando sem SSL...');
    sslConfig = { rejectUnauthorized: false };
  }
}

const poolBaseConfig = {
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  query_timeout: 30000,
};

if (sslConfig) {
  poolBaseConfig.ssl = sslConfig;
}

let poolConfig;
if (process.env.DB_HOST) {
  poolConfig = {
    ...poolBaseConfig,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'softhair',
    user: process.env.DB_USER || 'softhair',
    password: process.env.DB_PASSWORD || 'softhair',
  };
} else if (process.env.DATABASE_URL) {
  console.log('Usando DATABASE_URL');
  poolConfig = { ...poolBaseConfig, connectionString: process.env.DATABASE_URL };
} else {
  poolConfig = {
    ...poolBaseConfig,
    host: 'localhost',
    port: 5432,
    database: 'softhair',
    user: 'softhair',
    password: 'softhair',
  };
}

const pool = new Pool(poolConfig);

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
  const result = await pool.query(convertPlaceholders(sql), params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(convertPlaceholders(sql), params);
  return result.rows[0] || null;
}

async function queryRun(sql, params = []) {
  const result = await pool.query(convertPlaceholders(sql), params);
  return { rowCount: result.rowCount, rows: result.rows };
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function clientQuery(client, sql, params = []) {
  const result = await client.query(convertPlaceholders(sql), params);
  return result.rows;
}

async function clientQueryOne(client, sql, params = []) {
  const result = await client.query(convertPlaceholders(sql), params);
  return result.rows[0] || null;
}

async function clientQueryRun(client, sql, params = []) {
  const result = await client.query(convertPlaceholders(sql), params);
  return { rowCount: result.rowCount, rows: result.rows };
}

module.exports = { pool, query, queryOne, queryRun, withTransaction, clientQuery, clientQueryOne, clientQueryRun };
