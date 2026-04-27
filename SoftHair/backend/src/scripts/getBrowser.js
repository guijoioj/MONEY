#!/usr/bin/env node

const Database = require('better-sqlite3');
const { getPaths } = require('../config/appPaths');

const { dbPath } = getPaths();

let db;
try {
  db = new Database(dbPath, { readonly: true });
  const config = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get('navegador');
  console.log(config ? config.valor : 'firefox');
  db.close();
} catch (err) {
  console.log('firefox');
}
