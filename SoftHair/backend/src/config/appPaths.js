const path = require('path');
const fs = require('fs');

function resolvePath(value, fallback) {
  if (!value) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function getPaths() {
  const baseDir = resolvePath(process.env.SOFTHAIR_ROOT_DIR, path.resolve(__dirname, '..', '..'));

  const dataDir = resolvePath(process.env.SOFTHAIR_DATA_DIR, path.join(baseDir, 'data'));
  const backupDir = resolvePath(process.env.SOFTHAIR_BACKUP_DIR, path.join(baseDir, 'backups'));
  const configDir = resolvePath(process.env.SOFTHAIR_CONFIG_DIR, path.join(baseDir, 'config'));

  return {
    baseDir,
    dataDir,
    backupDir,
    tempUploadDir: path.join(backupDir, 'temp'),
    configDir,
    dbPath: path.join(dataDir, 'salao.db'),
    googleDriveConfigPath: path.join(configDir, 'google-drive.json'),
    googleDriveTokensPath: path.join(configDir, 'google-drive-tokens.json')
  };
}

function ensureDirIfMissing(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureRuntimeDirs(paths = getPaths()) {
  ensureDirIfMissing(paths.baseDir);
  ensureDirIfMissing(paths.dataDir);
  ensureDirIfMissing(paths.backupDir);
  ensureDirIfMissing(paths.tempUploadDir);
  ensureDirIfMissing(paths.configDir);
}

module.exports = {
  getPaths,
  ensureRuntimeDirs
};
