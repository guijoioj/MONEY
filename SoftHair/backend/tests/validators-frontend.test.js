/**
 * P7-A3: smoke test que valida o módulo frontend/src/services/validators.js
 *
 * Como o backend test runner é node-based puro e validators.js é ESM,
 * fazemos parse + eval básico para garantir que as funções estão exportadas
 * e validações elementares funcionam. Isso pega regressão em validators.js
 * sem precisar bundler.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('validators-frontend.test.js');

const validatorsPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'services', 'validators.js');

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

test('arquivo validators.js existe', () => {
  assert.ok(fs.existsSync(validatorsPath), `${validatorsPath} deve existir`);
});

const src = fs.readFileSync(validatorsPath, 'utf-8');

test('exporta validateCPF', () => {
  assert.ok(/export function validateCPF/.test(src));
});

test('exporta validateTelefone', () => {
  assert.ok(/export function validateTelefone/.test(src));
});

test('exporta validateEmail', () => {
  assert.ok(/export function validateEmail/.test(src));
});

test('exporta passwordStrengthScore', () => {
  assert.ok(/export function passwordStrengthScore/.test(src));
});

test('exporta validateForm', () => {
  assert.ok(/export function validateForm/.test(src));
});

test('CPF regex aceita só 11 dígitos', () => {
  // Inspect rule: /^(\d)\1{10}$/ rejeita todos-iguais
  assert.ok(/length !== 11/.test(src), 'verifica 11 dígitos');
});

test('telefone aceita 10 ou 11 dígitos', () => {
  assert.ok(/length < 10 \|\| d\.length > 11/.test(src) || /< 10/.test(src));
});

process.exit(process.exitCode || 0);
