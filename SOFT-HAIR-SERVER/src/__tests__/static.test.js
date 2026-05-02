const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function listJsFiles(relativeDir) {
  const baseDir = path.join(rootDir, relativeDir);
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
  }

  walk(baseDir);
  return files;
}

describe('static module health', () => {
  test('all source JavaScript files parse', () => {
    const files = listJsFiles('.');
    for (const file of files) {
      execFileSync(process.execPath, ['-c', file], { stdio: 'pipe' });
    }
  });

  test('models, middleware, routes and services can be required', () => {
    const files = [
      ...listJsFiles('models'),
      ...listJsFiles('middleware'),
      ...listJsFiles('routes'),
      ...listJsFiles('services')
    ].filter(file => !file.endsWith(`${path.sep}server.js`));

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-static-secret-with-at-least-32-chars';
    process.env.WS_ENABLED = 'false';

    for (const file of files) {
      expect(() => require(file)).not.toThrow();
    }
  });
});
