/**
 * P6-A5: integration test que garante que rotas chamadas pelo frontend não
 * retornem 404. Lista construída a partir do arquivo `frontend/src/services/api.js`.
 *
 * O test não bate em servidor real — monta app Express e chama os handlers
 * via supertest-like helper interno. Para evitar nova dep, fazemos um cliente
 * mínimo via `http.request` contra o app em uma porta efêmera.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');

console.log('routes-coverage.test.js');

// SQLite em diretório temporário isolado.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softhair-routes-test-'));
process.env.SOFTHAIR_DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'a'.repeat(32);
process.env.DATABASE_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

let app, initDb, server, baseUrl, jwt, JWT_SECRET, queryRun;
try {
  ({ initDb } = require('../src/config/initDb'));
  ({ queryRun } = require('../src/config/database'));
  initDb();
  // Cria um usuário admin para gerar JWT autenticado
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

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(baseUrl + urlPath);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
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

// Lista canonical de rotas GET esperadas pelo frontend (extraída de api.js).
// Foco: rotas que NÃO devem retornar 404. Aceito: 200 / 401 / 501 / 400.
const ROUTES = [
  // auth
  ['GET', '/api/auth/me'],
  ['GET', '/api/auth/needs-setup'],
  // entidades
  ['GET', '/api/clientes'],
  ['GET', '/api/profissionais'],
  ['GET', '/api/servicos'],
  ['GET', '/api/servicos/categorias'],
  ['GET', '/api/produtos'],
  ['GET', '/api/produtos/categorias'],
  ['GET', '/api/produtos/estoque-baixo'],
  ['GET', '/api/agendamentos'],
  ['GET', '/api/agendamentos/pendentes'],
  ['GET', '/api/agendamentos/proximos'],
  ['GET', '/api/atendimentos'],
  ['GET', '/api/vendas'],
  ['GET', '/api/vendas/estatisticas'],
  // financeiro
  ['GET', '/api/financeiro/dre'],
  ['GET', '/api/financeiro/projecao'],
  // bloqueios
  ['GET', '/api/bloqueios'],
  // configuracoes
  ['GET', '/api/configuracoes'],
  // saloes
  ['GET', '/api/saloes/me'],
  // backup
  ['GET', '/api/backup/local'],
  ['GET', '/api/backup/google/status'],
  // despesas
  ['GET', '/api/despesas'],
  ['GET', '/api/despesas/resumo'],
  // comissoes
  ['GET', '/api/comissoes'],
  ['GET', '/api/comissoes/pagas'],
  ['GET', '/api/comissoes/estornos'],
  // sync
  ['GET', '/api/sync/status'],
  ['GET', '/api/sync/conflicts'],
  // stubs
  ['GET', '/api/notificacoes/count'],
  ['GET', '/api/fechamentos'],
  ['GET', '/api/creditos'],
  ['GET', '/api/historico/cliente/1/resumo'],
  ['GET', '/api/app/pedidos/salao'],
];

(async () => {
  await startServer();
  await test('todas as rotas chamadas pelo frontend retornam ≠404', async () => {
    const failures = [];
    for (const [method, urlPath] of ROUTES) {
      const r = await request(method, urlPath);
      if (r.status === 404) {
        failures.push(`${method} ${urlPath} => 404`);
      }
    }
    if (failures.length > 0) {
      throw new Error('Rotas 404 detectadas:\n  ' + failures.join('\n  '));
    }
  });

  await test('rotas POST mutações principais aceitam payloads (não 404)', async () => {
    const cases = [
      ['POST', '/api/backup/create', null],
      ['POST', '/api/sync/configure', { cloudUrl: 'https://example.com/api' }],
      ['POST', '/api/auth/me/delete-account-data', { senha: 'x' }],
    ];
    const failures = [];
    for (const [method, urlPath, body] of cases) {
      const r = await request(method, urlPath, body);
      if (r.status === 404) failures.push(`${method} ${urlPath} => 404`);
    }
    if (failures.length > 0) {
      throw new Error('Rotas POST 404 detectadas:\n  ' + failures.join('\n  '));
    }
  });

  // Cleanup
  await new Promise((resolve) => server.close(resolve));
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) { /* skip */ }
  process.exit(process.exitCode || 0);
})();
