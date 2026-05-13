/**
 * P3-M10: smoke tests para lib/secrets (E1 + P2-C1 + P2-C2 + P2-B1).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { resolveJwtSecret } = require('../src/lib/secrets');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('secrets.test.js');

// Cleanup any leftover env that interferes
const origEnv = process.env.JWT_SECRET;
delete process.env.JWT_SECRET;

test('usa JWT_SECRET de env se presente e >= 32 chars', () => {
  const longSecret = 'a'.repeat(40);
  process.env.JWT_SECRET = longSecret;
  const s = resolveJwtSecret({ dataDir: '/nonexistent' });
  assert.equal(s, longSecret);
  delete process.env.JWT_SECRET;
});

test('ignora env curta e gera/lê arquivo', () => {
  process.env.JWT_SECRET = 'short';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-secrets-'));
  try {
    const s = resolveJwtSecret({ dataDir: tmpDir });
    assert.ok(s.length >= 32, `secret length ${s.length}`);
    assert.notEqual(s, 'short');
  } finally {
    delete process.env.JWT_SECRET;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('persiste secret entre chamadas', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-secrets-'));
  try {
    const s1 = resolveJwtSecret({ dataDir: tmpDir });
    const s2 = resolveJwtSecret({ dataDir: tmpDir });
    assert.equal(s1, s2, 'secret deveria ser idempotente');
    assert.ok(fs.existsSync(path.join(tmpDir, 'secrets.json')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('secret tem 64 chars hex (32 bytes — P2-B1)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-secrets-'));
  try {
    const s = resolveJwtSecret({ dataDir: tmpDir });
    assert.equal(s.length, 64, `expected 64 hex chars, got ${s.length}`);
    assert.match(s, /^[0-9a-f]+$/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('requirePersisted lança em dataDir inválido', () => {
  const badDir = '/dev/null/cannot-create';
  assert.throws(() => {
    resolveJwtSecret({ dataDir: badDir, requirePersisted: true });
  });
});

test('arquivo escrito com mode 0o600 (POSIX)', () => {
  if (process.platform === 'win32') {
    console.log('    (skipped on Windows)');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-secrets-'));
  try {
    resolveJwtSecret({ dataDir: tmpDir });
    const st = fs.statSync(path.join(tmpDir, 'secrets.json'));
    const mode = st.mode & 0o777;
    assert.equal(mode, 0o600, `mode 0o${mode.toString(8)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Restore env
if (origEnv !== undefined) process.env.JWT_SECRET = origEnv;

console.log(process.exitCode === 1 ? 'FAIL' : 'OK');
