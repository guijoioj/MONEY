# backend/src/scripts/restore.js

**Repository:** Desktop
**File:** `backend/src/scripts/restore.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/scripts/restore.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
require('dotenv').config();
const BackupService = require('../services/backupService');

async function restoreBackup() {
  const filename = process.argv[2];
  
  if (!filename) {
    console.log('Uso: npm run restore <nome_do_arquivo>');
    console.log('\nBackups disponíveis:');
    const backups = BackupService.getLocalBackups();
    backups.forEach(b => {
      console.log(`  - ${b.filename}`);
    });
    process.exit(1);
  }

  try {
    console.log(`Restaurando backup: ${filename}...`);
    const result = await BackupService.restoreBackupFromFilename(filename);
    console.log('Backup restaurado com sucesso!');
  } catch (error) {
    console.error('Erro ao restaurar backup:', error.message);
    process.exit(1);
  }
}

restoreBackup();
```
