/**
 * Electron main process — SoftHair desktop.
 *
 * Em produção:
 *   - faz fork do backend embarcado (backend/src/server.js)
 *   - backend usa SQLite local em userData/SoftHair/database/
 *   - frontend carrega de frontend/dist/index.html
 *
 * Em dev (--dev):
 *   - backend deve estar rodando manualmente
 *   - frontend é servido pelo Vite em http://localhost:3000
 */

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const http = require('http');
const { setupAutoUpdater } = require('./updater');
const serverConfig = require('./serverConfig');

let mainWindow;
let backendProcess;
let isQuitting = false;
const isDev = process.argv.includes('--dev');

function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', relativePath);
}

function startBackend() {
  console.log('[Electron] Iniciando backend embarcado...');

  const serverPath = getResourcePath(path.join('backend', 'src', 'server.js'));
  const dataDir = path.join(app.getPath('userData'), 'SoftHair', 'database');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log('[Electron] Server path:', serverPath);
  console.log('[Electron] Data dir:', dataDir);

  if (!fs.existsSync(serverPath)) {
    console.error('[Electron] Servidor não encontrado em:', serverPath);
    dialog.showErrorBox('SoftHair', `Backend não encontrado em ${serverPath}`);
    return;
  }

  backendProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.SOFTHAIR_PORT || '3001',
      HOST: '127.0.0.1',
      DATABASE_TYPE: process.env.DATABASE_TYPE || 'sqlite',
      SOFTHAIR_DATA_DIR: dataDir,
      JWT_SECRET: process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex'),
      JWT_EXPIRES_IN: '30d',
      SOFTHAIR_DEFAULT_ADMIN_EMAIL: process.env.SOFTHAIR_DEFAULT_ADMIN_EMAIL || 'admin@salao.com',
      SOFTHAIR_DEFAULT_ADMIN_PASSWORD: process.env.SOFTHAIR_DEFAULT_ADMIN_PASSWORD || 'TROQUE_NA_PRIMEIRA_LOGIN',
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  backendProcess.on('error', (err) => {
    console.error('[Electron] Erro no backend:', err);
    if (!isQuitting) {
      dialog.showErrorBox('SoftHair', `Falha ao iniciar backend: ${err.message}`);
    }
  });

  if (backendProcess.stdout) {
    backendProcess.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  }
  if (backendProcess.stderr) {
    backendProcess.stderr.on('data', (d) => process.stderr.write(`[backend:err] ${d}`));
  }

  backendProcess.on('close', (code) => {
    console.log('[Electron] Backend encerrou com código:', code);
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox('SoftHair', 'O backend encerrou inesperadamente.');
    }
  });
}

function waitForBackend(retries, delay, cb) {
  http
    .get('http://127.0.0.1:3001/api/health', (res) => {
      if (res.statusCode === 200) return cb();
      if (retries > 0) setTimeout(() => waitForBackend(retries - 1, delay, cb), delay);
      else cb();
    })
    .on('error', () => {
      if (retries > 0) setTimeout(() => waitForBackend(retries - 1, delay, cb), delay);
      else cb();
    });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#ffffff',
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // TEMP DEBUG: abrir DevTools sempre pra capturar erro de tela branca.
  mainWindow.webContents.openDevTools();
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      dialog.showErrorBox('SoftHair', `Erro ao carregar dev URL: ${err.message}`);
    });
  } else {
    const indexPath = getResourcePath(path.join('frontend', 'dist', 'index.html'));
    const indexURL = 'file://' + indexPath;

    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('file://') && !url.startsWith(indexURL)) {
        event.preventDefault();
      }
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -6 && validatedURL && validatedURL.startsWith('file://') && !validatedURL.startsWith(indexURL)) {
        mainWindow.loadFile(indexPath).catch(() => {});
      }
    });

    mainWindow.loadFile(indexPath).catch(() => {
      dialog.showErrorBox('SoftHair', 'Não foi possível carregar a interface. Rode `npm run build:frontend`.');
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const navigate = (route) => {
    if (mainWindow) mainWindow.webContents.executeJavaScript(`window.location.hash = '#${route}'`);
  };

  const template = [
    {
      label: 'SoftHair',
      submenu: [
        { label: 'Sobre SoftHair', role: 'about' },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' },
      ],
    },
    { label: 'Dashboard', click: () => navigate('/dashboard') },
    { label: 'Agenda', click: () => navigate('/agenda') },
    { label: 'Clientes', click: () => navigate('/clientes') },
    { label: 'Atendimentos', click: () => navigate('/atendimentos') },
    { label: 'Vendas', click: () => navigate('/vendas') },
    {
      label: 'Sistema',
      submenu: [
        { label: 'Sync com Cloud', click: () => navigate('/sync') },
        { label: 'Configurações', click: () => navigate('/configuracoes') },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Manual de Uso',
          click: () => {
            const manualPath = getResourcePath('MANUAL-DE-USO.html');
            if (fs.existsSync(manualPath)) shell.openPath(manualPath);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC: tela "Configurar Servidor" lê/escreve serverConfig
ipcMain.handle('server-config:get', () => serverConfig.load());
ipcMain.handle('server-config:set', (_e, cfg) => {
  const ok = serverConfig.save(cfg);
  return { ok };
});
ipcMain.handle('server-config:presets', () => serverConfig.PRESETS);

app.whenReady().then(() => {
  const useEmbeddedBackend = serverConfig.shouldStartEmbeddedBackend();

  if (!isDev && useEmbeddedBackend) {
    // Modo embarcado: sobe backend SQLite local
    startBackend();
    waitForBackend(60, 500, () => {
      createWindow();
      setupAutoUpdater(mainWindow);
    });
  } else if (!isDev && !useEmbeddedBackend) {
    // Modo central (cérebro local / Render): só frontend, sem backend embarcado
    console.log('[Electron] Modo central — backend NÃO embarcado. URL:', serverConfig.getApiUrl());
    createWindow();
    setupAutoUpdater(mainWindow);
  } else {
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  isQuitting = true;
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (backendProcess) backendProcess.kill();
});
