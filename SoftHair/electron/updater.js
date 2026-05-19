/**
 * Auto-update via electron-updater + GitHub Releases.
 *
 * - Checa atualizações 30s após boot
 * - Re-checa a cada 4h
 * - Notifica usuário antes de instalar (não força reboot)
 * - Logs em userData/logs/main.log
 */

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { dialog } = require('electron');

log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater(mainWindow) {
  // Dev: nunca checa. Updater quebra em dev sem app empacotado.
  if (process.argv.includes('--dev') || !require('electron').app.isPackaged) {
    log.info('[updater] dev mode — pulando auto-update');
    return;
  }

  autoUpdater.on('error', (err) => {
    log.error('[updater] erro:', err);
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[updater] update disponível:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', { version: info.version });
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] já está na última versão');
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[updater] baixando ${progress.percent.toFixed(1)}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log.info('[updater] download completo, versão:', info.version);
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `SoftHair v${info.version} foi baixado.`,
      detail: 'Reiniciar agora para aplicar a atualização?',
    });
    if (choice.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Primeira checagem após 30s (deixa o app subir)
  setTimeout(() => autoUpdater.checkForUpdates().catch((e) => log.error(e)), 30_000);

  // Re-checa a cada 4h
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e) => log.error(e));
  }, 4 * 60 * 60 * 1000);
}

module.exports = { setupAutoUpdater };
