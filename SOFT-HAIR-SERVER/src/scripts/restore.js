#!/usr/bin/env node
// [P5-B3] Script removido — métodos `getLocalBackups` / `restoreBackupFromFilename`
// nunca existiram em services/BackupService.js. Para restaurar backup, use:
//   POST /api/backup/restore { backup: { ... } }
// ou consuma BackupService.restaurarBackup(salaoId, backupData) diretamente.

if (require.main === module) {
  console.error('Este script foi removido. Use POST /api/backup/restore ou BackupService.restaurarBackup().');
  process.exit(1);
}

module.exports = {};
