const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
}

module.exports = { initDb };
