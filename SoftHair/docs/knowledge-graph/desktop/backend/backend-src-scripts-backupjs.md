# backend/src/scripts/backup.js

**Repository:** Desktop
**File:** `backend/src/scripts/backup.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/scripts/backup.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
require('dotenv').config();
const BackupService = require('../services/backupService');

async function createBackup() {
  try {
    console.log('Criando backup...');
    const backup = await BackupService.createBackup();
    console.log('Backup criado com sucesso!');
    console.log(`Arquivo: ${backup.filepath}`);
    console.log(`Tamanho: ${(backup.size / 1024).toFixed(2)} KB`);
    console.log(`Data: ${backup.createdAt}`);
  } catch (error) {
    console.error('Erro ao criar backup:', error.message);
    process.exit(1);
  }
}

createBackup();
```
