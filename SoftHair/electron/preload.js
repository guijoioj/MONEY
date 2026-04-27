const { contextBridge, shell, app } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electron', {
  openExternal: (url) => shell.openExternal(url),
  getAppPath: () => app.getAppPath(),
  getPlatform: () => process.platform,
  openPath: (filePath) => shell.openPath(path.dirname(filePath)),
  showItemInFolder: (filePath) => shell.showItemInFolder(filePath)
});