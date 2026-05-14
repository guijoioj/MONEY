/**
 * P7-A1: integration test do flow bootstrap → login → /me.
 *
 * Cobre regressões em P3-C1 (setup wizard) e P7-A10 (race fix em bootstrap).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');

console.log('authFlow.test.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-auth-test-'));
process.env.SOFTHAIR_DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'a'.repeat(32);
process.env.DATABASE_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

let app, initDb, server, baseUrl;
try {
  ({ initDb } = require('../src/config/initDb'));
  initDb();
  app = require('../src/server');
} catch (e) {
  if (e && e.message && /better_sqlite3/.test(e.message)) {
    console.log('  ⊘ SKIPPED — better-sqlite3 native binding mismatch (Node version)');
    console.log('OK');
    process.exit(0);
  }
  throw e;
}

function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(baseUrl + urlPath);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((e) => {
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
      process.exitCode = 1;
    });
}

(async () => {
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      r();
    });
  });

  await test('GET /auth/needs-setup retorna needsSetup=true em DB fresh', async () => {
    const r = await request('GET', '/api/auth/needs-setup');
    assert.equal(r.status, 200);
    assert.equal(r.body?.data?.needsSetup, true);
  });

  await test('POST /auth/bootstrap-admin cria primeiro admin', async () => {
    const r = await request('POST', '/api/auth/bootstrap-admin', {
      email: 'admin@test.com',
      senha: 'Senha123',
      nome: 'Test Admin',
    });
    assert.equal(r.status, 200);
    assert.equal(r.body?.success, true);
  });

  await test('GET /auth/needs-setup agora retorna needsSetup=false', async () => {
    const r = await request('GET', '/api/auth/needs-setup');
    assert.equal(r.status, 200);
    assert.equal(r.body?.data?.needsSetup, false);
  });

  await test('POST /auth/bootstrap-admin segunda vez é rejeitado (P2-A7/P7-A10)', async () => {
    const r = await request('POST', '/api/auth/bootstrap-admin', {
      email: 'admin2@test.com',
      senha: 'Senha123',
      nome: 'Outro Admin',
    });
    assert.ok(r.status === 403 || r.status === 409,
      `esperado 403 ou 409, recebido ${r.status}`);
  });

  let token;
  await test('POST /auth/login com credenciais corretas retorna token', async () => {
    const r = await request('POST', '/api/auth/login', {
      email: 'admin@test.com',
      senha: 'Senha123',
    });
    assert.equal(r.status, 200);
    assert.ok(r.body?.data?.token, 'token presente');
    token = r.body.data.token;
  });

  await test('GET /auth/me com token retorna o user', async () => {
    const r = await request('GET', '/api/auth/me', null, token);
    assert.equal(r.status, 200);
    assert.equal(r.body?.data?.email, 'admin@test.com');
  });

  await test('GET /auth/me sem token retorna 401', async () => {
    const r = await request('GET', '/api/auth/me');
    assert.equal(r.status, 401);
  });

  // P7-M1: LGPD export
  await test('GET /auth/me/export-data retorna payload completo', async () => {
    const r = await request('GET', '/api/auth/me/export-data', null, token);
    assert.equal(r.status, 200);
    assert.ok(r.body?.salao, 'salao incluído');
    assert.ok(Array.isArray(r.body?.clientes), 'clientes é array');
    assert.ok(Array.isArray(r.body?.produtos), 'produtos é array');
    assert.equal(r.body?.version, 1);
    // Nunca incluir senha
    assert.ok(!JSON.stringify(r.body).includes('senha_hash'),
      'senha_hash nunca pode vazar em export');
  });

  await new Promise((r) => server.close(r));
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* skip */ }
  process.exit(process.exitCode || 0);
})();
