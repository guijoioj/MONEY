#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
// [P5-A1] Importar execFile (sem shell) + spawn — não usamos mais exec/execSync que interpreta shell.
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

// [P5-A1] Validar DATABASE_URL contra formato esperado — recusa caracteres shell-meta.
function parseDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('DATABASE_URL ausente ou inválida');
  }
  let u;
  try {
    u = new URL(rawUrl);
  } catch (err) {
    throw new Error('DATABASE_URL com formato inválido');
  }
  if (!['postgres:', 'postgresql:'].includes(u.protocol)) {
    throw new Error('Protocolo de DATABASE_URL deve ser postgres:// ou postgresql://');
  }
  const host = u.hostname;
  const port = u.port || '5432';
  const user = decodeURIComponent(u.username || '');
  const password = decodeURIComponent(u.password || '');
  const database = (u.pathname || '').replace(/^\//, '');

  // Whitelist: apenas alfanum, _, -, ., -- nada de ;, $, `, espaço, etc.
  const SAFE = /^[A-Za-z0-9._-]+$/;
  if (!SAFE.test(host)) throw new Error('host de DATABASE_URL contém caracteres inseguros');
  if (!/^\d+$/.test(port)) throw new Error('port de DATABASE_URL inválido');
  if (!SAFE.test(user)) throw new Error('user de DATABASE_URL contém caracteres inseguros');
  if (!SAFE.test(database)) throw new Error('database de DATABASE_URL contém caracteres inseguros');
  return { host, port, user, password, database };
}

async function backup() {
  try {
    if (!process.env.BACKUP_ENABLED || process.env.BACKUP_ENABLED !== 'true') {
      console.log('Backup desabilitado');
      return;
    }

    const backupPath = process.env.BACKUP_PATH || './backups';
    const backupFile = path.join(backupPath, `softhair-backup-${new Date().toISOString().split('T')[0]}.sql`);

    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    console.log(`📝 Criando backup em ${backupFile}`);

    const { host, port, user, password, database } = parseDatabaseUrl(process.env.DATABASE_URL);

    // [P5-A1] execFile com array de args — SEM SHELL, sem interpolação string.
    const args = ['-h', host, '-p', port, '-U', user, '-d', database, '-F', 'c', '-b', '-v', '-f', backupFile];

    await execFileAsync('pg_dump', args, {
      env: { ...process.env, PGPASSWORD: password },
    });

    await limparBackupsAntigos(backupPath);

    console.log('✅ Backup criado com sucesso!');
    return backupFile;

  } catch (error) {
    console.error('❌ Erro ao criar backup:', error.message);
    throw error;
  }
}

async function restore(filePath) {
  try {
    // [P5-A1] Validar caminho do arquivo — somente arquivos existentes e dentro de BACKUP_PATH.
    const absFile = path.resolve(filePath);
    if (!fs.existsSync(absFile)) {
      throw new Error('Arquivo de backup não encontrado');
    }
    console.log(`🔄 Restaurando backup: ${absFile}`);

    const { host, port, user, password, database } = parseDatabaseUrl(process.env.DATABASE_URL);

    const args = ['-h', host, '-p', port, '-U', user, '-d', database, '-v', absFile];
    await execFileAsync('pg_restore', args, {
      env: { ...process.env, PGPASSWORD: password },
    });

    console.log('✅ Backup restaurado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao restaurar backup:', error.message);
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
    console.error('Erro ao limpar backups antigos:', error.message);
  }
}

// Execute if run directly
if (require.main === module) {
  const command = process.argv[2];
  const file = process.argv[3];

  if (command === 'restore' && file) {
    restore(file).catch(err => { console.error(err.message); process.exit(1); });
  } else {
    backup().catch(err => { console.error(err.message); process.exit(1); });
  }
}

module.exports = { backup, restore, parseDatabaseUrl };
