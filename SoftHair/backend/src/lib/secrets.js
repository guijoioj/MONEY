/**
 * Centraliza a geração/leitura do JWT_SECRET local.
 *
 * Pass 2 fixes:
 *   - P2-C1: um único módulo cuida do path do secrets.json (eliminando o
 *            duplo path entre electron/main.js e middleware/auth.js).
 *   - P2-C2: write atomic com rename para evitar race de gravação.
 *   - P2-B1: 32 bytes hex (não 48) — suficiente para HS256.
 *   - P2-B5: caller é quem decide o que fazer em erro (abort em prod, etc).
 *
 * Uso:
 *   const { resolveJwtSecret } = require('./lib/secrets');
 *   const secret = resolveJwtSecret({ dataDir, requirePersisted: true });
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRET_BYTES = 32; // 256 bits — HS256/HS512 canônico
const SECRETS_FILE = 'secrets.json';

function readSecret(secretsFile) {
  try {
    if (!fs.existsSync(secretsFile)) return null;
    const cfg = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
    if (typeof cfg.jwtSecret === 'string' && cfg.jwtSecret.length >= 32) {
      return cfg.jwtSecret;
    }
  } catch (_) { /* arquivo corrupto */ }
  return null;
}

function writeSecretAtomic(secretsFile, secret) {
  const tmp = secretsFile + '.' + process.pid + '.' + Date.now() + '.tmp';
  const payload = JSON.stringify(
    { jwtSecret: secret, createdAt: new Date().toISOString() },
    null,
    2
  );
  // P2-C2: escrever em tmp e renomear (atomic em POSIX).
  fs.writeFileSync(tmp, payload, { mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch (_) { /* Windows */ }
  try {
    fs.renameSync(tmp, secretsFile);
  } catch (e) {
    // Windows pode falhar rename se target existir — fallback unlink + rename
    try { fs.unlinkSync(secretsFile); } catch (_) { /* noop */ }
    fs.renameSync(tmp, secretsFile);
  }
  try { fs.chmodSync(secretsFile, 0o600); } catch (_) { /* Windows */ }
}

/**
 * Resolve o JWT_SECRET. Estratégia:
 *  1. Se `process.env.JWT_SECRET` ≥ 32 chars, usa.
 *  2. Lê de `<dataDir>/secrets.json`.
 *  3. Gera novo (32 bytes hex) e persiste.
 *
 * @param {object} opts
 * @param {string} opts.dataDir — diretório para persistir o secret.
 * @param {boolean} [opts.requirePersisted=false] — em true, lança em vez de
 *        gerar um secret efêmero quando o disco está indisponível.
 * @returns {string}
 */
function resolveJwtSecret({ dataDir, requirePersisted = false } = {}) {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  if (!dataDir) {
    if (requirePersisted) {
      throw new Error('resolveJwtSecret: dataDir obrigatório e sem JWT_SECRET');
    }
    // P2-B1: 32 bytes
    return crypto.randomBytes(SECRET_BYTES).toString('hex');
  }
  const secretsFile = path.join(dataDir, SECRETS_FILE);
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const existing = readSecret(secretsFile);
    if (existing) return existing;
    // P2-B1: 32 bytes hex (suficiente para HS256, 256-bit key)
    const generated = crypto.randomBytes(SECRET_BYTES).toString('hex');
    writeSecretAtomic(secretsFile, generated);
    return generated;
  } catch (e) {
    if (requirePersisted) {
      const err = new Error(`Falha ao persistir JWT secret em ${secretsFile}: ${e.message}`);
      err.cause = e;
      throw err;
    }
    // Fallback efêmero (CI/testes)
    return crypto.randomBytes(SECRET_BYTES).toString('hex');
  }
}

module.exports = { resolveJwtSecret, SECRETS_FILE };
