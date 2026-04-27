# backend/src/config/initDb.js

**Repository:** Desktop
**File:** `backend/src/config/initDb.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/config/initDb.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

- [[desktop/entities/initdbjs-ccb084b0|initDb.js]]

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
}

module.exports = { initDb };
```
