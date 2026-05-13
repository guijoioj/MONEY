/**
 * P3-M10: runner simples para todos os testes em SoftHair/backend/tests/.
 *
 * Uso: node tests/runAll.js
 *
 * Sem jest — usa só node:test/node:assert built-in. Os arquivos test.js
 * imprimem 'OK' ou 'FAIL' via process.exitCode.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(dir, f));

let totalFail = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    totalFail++;
  }
}

console.log('');
console.log(`Total: ${files.length} test files, ${totalFail} failed`);
process.exit(totalFail > 0 ? 1 : 0);
