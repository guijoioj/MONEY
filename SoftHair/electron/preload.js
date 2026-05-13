const { contextBridge, shell, ipcRenderer } = require('electron');
const path = require('path');

// E12: whitelist de protocolos. Bloqueia file://, javascript:, ms-windows-store://, etc.
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

function safeOpenExternal(url) {
  try {
    const u = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
      throw new Error(`protocolo bloqueado: ${u.protocol}`);
    }
    // Bloqueia http:// que não seja loopback
    if (u.protocol === 'http:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      throw new Error('http externo não permitido');
    }
    return shell.openExternal(url);
  } catch (e) {
    console.error('[preload] openExternal blocked:', e.message);
    return Promise.reject(e);
  }
}

function safeOpenPath(filePath) {
  // Só permite abrir diretório do arquivo dado — caminhos absolutos do próprio app.
  if (typeof filePath !== 'string' || !filePath.length) return Promise.reject(new Error('path inválido'));
  return shell.openPath(path.dirname(filePath));
}

function safeShowItemInFolder(filePath) {
  if (typeof filePath !== 'string' || !filePath.length) return;
  return shell.showItemInFolder(filePath);
}

contextBridge.exposeInMainWorld('electron', {
  openExternal: safeOpenExternal,
  // E26: não expor path absoluto. Apenas se está empacotado e a plataforma.
  isPackaged: () => process.env.ELECTRON_IS_PACKAGED === 'true',
  getPlatform: () => process.platform,
  openPath: safeOpenPath,
  showItemInFolder: safeShowItemInFolder,
});
