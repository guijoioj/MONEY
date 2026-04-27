# backend/src/scripts/getBrowser.js

**Repository:** Desktop
**File:** `backend/src/scripts/getBrowser.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/scripts/getBrowser.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
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
```
