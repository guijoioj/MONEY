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
