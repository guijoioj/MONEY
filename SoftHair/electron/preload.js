const { contextBridge, ipcRenderer, shell } = require('electron');

// Sandbox-safe: sem require('path'). Calcula dirname com string ops.
function dirname(filePath) {
  if (typeof filePath !== 'string') return filePath;
  const sep = filePath.includes('\\') ? '\\' : '/';
  const idx = filePath.lastIndexOf(sep);
  return idx === -1 ? filePath : filePath.slice(0, idx);
}

contextBridge.exposeInMainWorld('electron', {
  openExternal: (url) => shell.openExternal(url),
  getPlatform: () => process.platform,
  openPath: (filePath) => shell.openPath(dirname(filePath)),
  showItemInFolder: (filePath) => shell.showItemInFolder(filePath),
  onNavigate: (cb) => {
    const listener = (_e, route) => cb(route);
    ipcRenderer.on('navigate', listener);
    return () => ipcRenderer.removeListener('navigate', listener);
  },
});
