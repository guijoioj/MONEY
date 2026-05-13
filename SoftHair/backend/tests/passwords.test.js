/**
 * P3-M10: smoke tests para o lib/passwords (P2-A6 + P3-C6).
 *
 * Rodar com:
 *   cd SoftHair/backend && node tests/passwords.test.js
 *
 * Sem dependência de jest — usa assert nativo do node para zero-config setup.
 */

const assert = require('node:assert/strict');
const { isStrongPassword } = require('../src/lib/passwords');

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

console.log('passwords.test.js');

test('rejeita senha curta', () => {
  assert.equal(isStrongPassword('Ab1xx'), false);
  assert.equal(isStrongPassword('Ab123'), false);
});

test('rejeita senha comum mesmo com 8+ chars', () => {
  assert.equal(isStrongPassword('12345678'), false);
  assert.equal(isStrongPassword('password'), false);
  assert.equal(isStrongPassword('admin123'), false);
  assert.equal(isStrongPassword('Password123'.toLowerCase()), false); // case-insensitive
});

test('rejeita sem maiúscula', () => {
  assert.equal(isStrongPassword('abcdef12'), false);
});

test('rejeita sem minúscula', () => {
  assert.equal(isStrongPassword('ABCDEF12'), false);
});

test('rejeita sem dígito', () => {
  assert.equal(isStrongPassword('Abcdefgh'), false);
});

test('aceita senha forte', () => {
  assert.equal(isStrongPassword('MinhaSenha1'), true);
  assert.equal(isStrongPassword('SoftHair2026!'), true);
  assert.equal(isStrongPassword('Aa1bbbbbb'), true);
});

test('rejeita tipos não-string', () => {
  assert.equal(isStrongPassword(null), false);
  assert.equal(isStrongPassword(undefined), false);
  assert.equal(isStrongPassword(12345678), false);
  assert.equal(isStrongPassword({}), false);
});

console.log(process.exitCode === 1 ? 'FAIL' : 'OK');
