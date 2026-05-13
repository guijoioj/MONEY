/**
 * P3-M10: smoke tests para validateId middleware (E28 + P2-A2).
 */

const assert = require('node:assert/strict');
const { validateId } = require('../src/middleware/validateId');

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

// Mock helpers
function makeReqRes() {
  const req = { params: {} };
  const res = {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return { req, res };
}

console.log('validateId.test.js');

test('aceita inteiro positivo', () => {
  const { req, res } = makeReqRes();
  let nextCalled = false;
  validateId(req, res, () => { nextCalled = true; }, '42');
  assert.equal(nextCalled, true);
  assert.equal(req.params.id, 42);
});

test('rejeita zero', () => {
  const { req, res } = makeReqRes();
  validateId(req, res, () => {}, '0');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('rejeita negativo', () => {
  const { req, res } = makeReqRes();
  validateId(req, res, () => {}, '-1');
  assert.equal(res.statusCode, 400);
});

test('rejeita não-numérico', () => {
  const { req, res } = makeReqRes();
  validateId(req, res, () => {}, 'abc');
  assert.equal(res.statusCode, 400);
});

test('rejeita float', () => {
  const { req, res } = makeReqRes();
  validateId(req, res, () => {}, '1.5');
  assert.equal(res.statusCode, 400);
});

test('rejeita SQL injection attempt', () => {
  const { req, res } = makeReqRes();
  validateId(req, res, () => {}, "1 OR 1=1");
  assert.equal(res.statusCode, 400);
});

test('rejeita string vazia', () => {
  const { req, res } = makeReqRes();
  validateId(req, res, () => {}, '');
  assert.equal(res.statusCode, 400);
});

console.log(process.exitCode === 1 ? 'FAIL' : 'OK');
