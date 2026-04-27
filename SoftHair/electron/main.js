const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#ffffff',
    webSecurity: true
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(err => {
      console.log('Erro ao carregar URL de desenvolvimento:', err);
      dialog.showErrorBox(
        'SoftHair',
        `Não foi possivel carregar a interface no endereço http://localhost:3000.\n\n${err.message || err}`
      );
    });
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = getResourcePath('frontend/dist/index.html');
    const indexURL = 'file://' + indexPath;
    console.log('Carregando:', indexPath);

    // Intercept navigations triggered by HashRouter to prevent Electron from
    // treating hash-only route changes as new file:// URL loads.
    // When React Router navigates to e.g. file:///#/login (missing the file path),
    // Electron tries to load that as a new file and fails with ERR_FILE_NOT_FOUND.
    // We block any file:// navigation that doesn't target the index.html itself.
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('file://') && !url.startsWith(indexURL)) {
        console.log('Bloqueando navegação indevida para:', url);
        event.preventDefault();
      }
    });

    // Safety net: if a file:// load still fails (e.g. on first load race),
    // reload the correct index.html.
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.log('Falha ao carregar:', errorCode, errorDescription, validatedURL);
      if (errorCode === -6 && validatedURL && validatedURL.startsWith('file://') && !validatedURL.startsWith(indexURL)) {
        console.log('Recarregando index.html após falha em navegação hash...');
        mainWindow.loadFile(indexPath).catch(err => {
          console.log('Erro ao recarregar index.html:', err);
        });
      }
    });

    mainWindow.loadFile(indexPath).catch(async (err) => {
      console.log('Erro ao carregar arquivo:', err);

      try {
        await mainWindow.loadURL('http://localhost:3000');
      } catch (fallbackErr) {
        console.log('Falha no fallback para localhost:3000:', fallbackErr);
        dialog.showErrorBox(
          'SoftHair',
          'Não foi possível carregar a interface do sistema.\n\nVerifique se o frontend foi construído (npm run build) ou se o servidor frontend esta rodando em 3000.'
        );
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const navigate = (route) => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`window.location.hash = '#${route}'`);
    }
  };

  const template = [
    {
      label: 'SoftHair',
      submenu: [
        { label: 'Sobre SoftHair', role: 'about' },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' }
      ]
    },
    {
      label: 'Dashboard',
      click: () => navigate('/dashboard')
    },
    {
      label: 'Agenda',
      click: () => navigate('/agenda')
    },
    {
      label: 'Solicitações',
      click: () => navigate('/solicitacoes')
    },
    {
      label: 'Clientes',
      click: () => navigate('/clientes')
    },
    {
      label: 'Atendimentos',
      click: () => navigate('/atendimentos')
    },
    {
      label: 'Vendas',
      click: () => navigate('/vendas')
    },
    {
      label: 'Fechamento',
      click: () => navigate('/fechamento')
    },
    {
      label: 'Gestão',
      submenu: [
        { label: 'Profissionais', click: () => navigate('/profissionais') },
        { label: 'Serviços e Produtos', click: () => navigate('/servicos-e-produtos') }
      ]
    },
    {
      label: 'Sistema',
      submenu: [
        { label: 'Notificações', click: () => navigate('/notificacoes') },
        { label: 'Backup', click: () => navigate('/backup') },
        { label: 'Configurações', click: () => navigate('/configuracoes') },
        { label: 'Customização', click: () => navigate('/customizacao') },
        { label: 'Administrativo', click: () => navigate('/administrativo') }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Selecionar Tudo', role: 'selectAll' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Recarregar', role: 'reload' },
        { label: 'Tela Cheia', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Zoom +', role: 'zoomIn' },
        { label: 'Zoom -', role: 'zoomOut' },
        { label: 'Zoom Padrão', role: 'resetZoom' }
      ]
    },
    {
      label: 'Janela',
      submenu: [
        { label: 'Minimizar', role: 'minimize' },
        { label: 'Fechar', role: 'close' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Manual de Uso',
          click: () => {
            const manualPath = getResourcePath('MANUAL-DE-USO.html');
            if (fs.existsSync(manualPath)) {
              shell.openPath(manualPath);
            }
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function startBackend() {
  console.log('Iniciando backend...');

  const backendDir = getResourcePath('backend');
  const serverPath = path.join(backendDir, 'src', 'server.js');
  const runtimeDataDir = path.join(app.getPath('userData'), 'SoftHair');

  console.log('Backend path:', backendDir);
  console.log('Server path:', serverPath);

  if (!fs.existsSync(serverPath)) {
    console.log('Servidor não encontrado em:', serverPath);
    return;
  }

  backendProcess = spawn('node', [serverPath], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3001',
      SOFTHAIR_ROOT_DIR: runtimeDataDir,
      JWT_SECRET: process.env.JWT_SECRET || 'softHair-dev-jwt-secret-change-me',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      SOFTHAIR_DEFAULT_ADMIN_EMAIL: process.env.SOFTHAIR_DEFAULT_ADMIN_EMAIL || 'admin@salao.com',
      SOFTHAIR_DEFAULT_ADMIN_PASSWORD: process.env.SOFTHAIR_DEFAULT_ADMIN_PASSWORD || 'admin123'
    },
    windowsHide: false
  });

  backendProcess.on('error', (err) => {
    const message = err && err.code === 'ENOENT'
      ? 'Não foi encontrado o executável do Node.js para iniciar o backend. Verifique se o Node.js está instalado.'
      : `Não foi possível iniciar o backend: ${err.message || err}`;

    console.error('Erro ao iniciar backend:', err);
    dialog.showErrorBox('SoftHair', message);
  });

  if (backendProcess.stdout) {
    backendProcess.stdout.on('data', (data) => {
      process.stdout.write(`Backend: ${data}`);
    });
  }

  if (backendProcess.stderr) {
    backendProcess.stderr.on('data', (data) => {
      process.stderr.write(`Backend Erro: ${data}`);
    });
  }

  backendProcess.on('close', (code) => {
    console.log('Backend fechado com código:', code);
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox(
        'SoftHair',
        'O backend encerrou com erro. Verifique o log do terminal para mais detalhes e se a porta 3001 está disponível.'
      );
    }
  });
}

function waitForBackend(retries, delay, callback) {
  http.get('http://localhost:3001/api/health', (res) => {
    if (res.statusCode === 200) {
      callback();
    } else if (retries > 0) {
      setTimeout(() => waitForBackend(retries - 1, delay, callback), delay);
    } else {
      callback();
    }
  }).on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForBackend(retries - 1, delay, callback), delay);
    } else {
      callback();
    }
  });
}

app.whenReady().then(() => {
  console.log('App ready, iniciando...');
  console.log('Modo desenvolvimento:', isDev);
  console.log('Packaged:', app.isPackaged);

  if (!isDev) {
    startBackend();
    waitForBackend(30, 500, () => {
      createWindow();
    });
  } else {
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  isQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});
