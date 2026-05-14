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

// P2-M4: navegação via IPC vinda do menu da app. Expõe um subscribe seguro
// (sem expor `on` direto pra evitar event-name spoofing). Só aceita 'navigate'.
function onNavigate(callback) {
  if (typeof callback !== 'function') return () => {};
  const handler = (_event, route) => {
    if (typeof route === 'string' && /^[\/A-Za-z0-9_-]+$/.test(route)) {
      try { callback(route); } catch (_) { /* swallow */ }
    }
  };
  ipcRenderer.on('navigate', handler);
  return () => ipcRenderer.removeListener('navigate', handler);
}

// P7-A7: notificação nativa do desktop. Em Windows mostra toast na barra de
// tarefas; em macOS no Notification Center; em Linux via libnotify. Usado
// para alertar owner do salão sobre novo agendamento mesmo quando o app está
// fora de foco (mobile envia → cloud → sync → owner não vê popup in-app).
//
// Validação: title/body devem ser strings curtas, sanitizadas para evitar
// injection se renderer comprometido tentasse abrir URL malicioso (Linux
// suporta tags HTML em body em algumas distros).
function safeNotify({ title, body }) {
  if (typeof title !== 'string' || typeof body !== 'string') return;
  // Limita tamanho para evitar abuse
  const safeTitle = title.slice(0, 100);
  const safeBody = body.slice(0, 300).replace(/<[^>]*>/g, ''); // strip tags
  try {
    ipcRenderer.send('softhair:notify', { title: safeTitle, body: safeBody });
  } catch (_) { /* swallow */ }
}

contextBridge.exposeInMainWorld('electron', {
  openExternal: safeOpenExternal,
  // E26: não expor path absoluto. Apenas se está empacotado e a plataforma.
  isPackaged: () => process.env.ELECTRON_IS_PACKAGED === 'true',
  getPlatform: () => process.platform,
  openPath: safeOpenPath,
  showItemInFolder: safeShowItemInFolder,
  // P2-M4: navegação a partir do menu da app.
  onNavigate,
  // P7-A7: notificação nativa para alertas off-focus.
  notify: safeNotify,
});
