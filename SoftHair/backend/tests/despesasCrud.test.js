/**
 * P7-A1: integration test do CRUD de despesas + resumo.
 *
 * Cobre regressão em P5-A1 + P6-A1 (porCategoria vs categorias aliases).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');

console.log('despesasCrud.test.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-despesas-test-'));
process.env.SOFTHAIR_DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'a'.repeat(32);
process.env.DATABASE_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

let app, initDb, server, baseUrl, jwt, JWT_SECRET;
try {
  ({ initDb } = require('../src/config/initDb'));
  initDb();
  jwt = require('jsonwebtoken');
  ({ JWT_SECRET } = require('../src/middleware/auth'));
  app = require('../src/server');
} catch (e) {
  if (e && e.message && /better_sqlite3/.test(e.message)) {
    console.log('  ⊘ SKIPPED — better-sqlite3 native binding mismatch (Node version)');
    console.log('OK');
    process.exit(0);
  }
  throw e;
}

const token = jwt.sign({ userId: 1, salaoId: 1, tipo: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(baseUrl + urlPath);
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    };
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

  const today = new Date();
  const mes = today.getMonth() + 1;
  const ano = today.getFullYear();
  const m = String(mes).padStart(2, '0');
  const dataStr = `${ano}-${m}-15`;

  let despesaId;
  await test('POST /despesas cria despesa', async () => {
    const r = await request('POST', '/api/despesas', {
      descricao: 'Aluguel',
      valor: 1500,
      categoria: 'Aluguel',
      data: dataStr,
    });
    assert.equal(r.status, 201);
    assert.ok(r.body?.data?.id);
    despesaId = r.body.data.id;
  });

  await test('POST /despesas com valor 0 é rejeitado', async () => {
    const r = await request('POST', '/api/despesas', {
      descricao: 'Teste',
      valor: 0,
      data: dataStr,
    });
    assert.equal(r.status, 400);
  });

  await test('POST /despesas sem descricao é rejeitado', async () => {
    const r = await request('POST', '/api/despesas', {
      valor: 100,
      data: dataStr,
    });
    assert.equal(r.status, 400);
  });

  await test('GET /despesas retorna lista', async () => {
    const r = await request('GET', `/api/despesas?mes=${mes}&ano=${ano}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body?.data));
    assert.ok(r.body.data.length >= 1, 'pelo menos a despesa criada');
  });

  await test('GET /despesas/resumo retorna porCategoria E categorias aliases (P6-A1)', async () => {
    const r = await request('GET', `/api/despesas/resumo?mes=${mes}&ano=${ano}`);
    assert.equal(r.status, 200);
    const d = r.body?.data || {};
    assert.ok(Array.isArray(d.porCategoria), 'porCategoria array');
    assert.ok(Array.isArray(d.categorias), 'categorias alias array');
    assert.equal(d.total >= 1500, true);
    // Aliases iguais
    assert.deepEqual(d.porCategoria, d.categorias);
  });

  await test('PUT /despesas/:id atualiza', async () => {
    const r = await request('PUT', `/api/despesas/${despesaId}`, { valor: 1600 });
    assert.equal(r.status, 200);
  });

  await test('DELETE /despesas/:id remove', async () => {
    const r = await request('DELETE', `/api/despesas/${despesaId}`);
    assert.equal(r.status, 200);
  });

  await new Promise((r) => server.close(r));
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* skip */ }
  process.exit(process.exitCode || 0);
})();
