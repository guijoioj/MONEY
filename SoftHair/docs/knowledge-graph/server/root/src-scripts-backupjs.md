# src/scripts/backup.js

**Repository:** Server
**File:** `src/scripts/backup.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/scripts/backup.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function backup() {
  try {
    if (!process.env.BACKUP_ENABLED || process.env.BACKUP_ENABLED !== 'true') {
      console.log('Backup desabilitado');
      return;
    }

    const backupPath = process.env.BACKUP_PATH || './backups';
    const backupFile = path.join(backupPath, `softhair-backup-${new Date().toISOString().split('T')[0]}.sql`);
    
    // Create backup directory if not exists
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    console.log(`📝 Criando backup em ${backupFile}`);
    
    // Parse database URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    const user = dbUrl.username;
    const password = dbUrl.password;
    const host = dbUrl.hostname;
    const port = dbUrl.port || 5432;
    const database = dbUrl.pathname.slice(1);

    // Set PGPASSWORD environment variable for pg_dump
    const pgDumpCommand = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F c -b -v -f "${backupFile}"`;
    
    const { env } = process;
    execSync(pgDumpCommand, { 
      env: { ...env, PGPASSWORD: password },
      stdio: 'pipe'
    });

    // Limpar backups antigos
    await limparBackupsAntigos(backupPath);
    
    console.log('✅ Backup criado com sucesso!');
    return backupFile;
    
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
    throw error;
  }
}

async function restore(filePath) {
  try {
    console.log(`🔄 Restaurando backup: ${filePath}`);
    
    // Parse database URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    const user = dbUrl.username;
    const password = dbUrl.password;
    const host = dbUrl.hostname;
    const port = dbUrl.port || 5432;
    const database = dbUrl.pathname.slice(1);

    // Execute restore command
    const pgRestoreCommand = `pg_restore -h ${host} -p ${port} -U ${user} -d ${database} -v "${filePath}"`;
    
    const { env } = process;
    execSync(pgRestoreCommand, { 
      env: { ...env, PGPASSWORD: password },
      stdio: 'inherit'
    });

    console.log('✅ Backup restaurado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao restaurar backup:', error);
    throw error;
  }
}

async function limparBackupsAntigos(backupPath) {
  const diasRetencao = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - diasRetencao);
  
  try {
    const diretorios = await fs.promises.readdir(backupPath);
    let deletados = 0;
    
    for (const arquivo of diretorios) {
      const stat = await fs.promises.stat(path.join(backupPath, arquivo));
      if (stat.mtime < cutoffDate) {
        await fs.promises.unlink(path.join(backupPath, arquivo));
        deletados++;
      }
    }
    
    console.log(`🧹 Arquivos de backup antigos removidos: ${deletados}`);
  } catch (error) {
    console.error('Erro ao limpar backups antigos:', error);
  }
}

// Execute if run directly
if (require.main === module) {
  const command = process.argv[2];
  const file = process.argv[3];
  
  if (command === 'restore' && file) {
    restore(file).catch(console.error);
  } else {
    backup().catch(console.error);
  }
}

module.exports = { backup, restore };
```
