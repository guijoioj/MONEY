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
 *
 * Pass 1 fixes:
 *   - E1: JWT_SECRET nunca hardcoded; persiste em userData/secrets.json
 *   - E11: requestSingleInstanceLock — evita 2 backends no mesmo db
 *   - E15: setWindowOpenHandler + will-navigate restritos
 *   - E20: sanitize de mensagens em dialog.showErrorBox
 *   - E21: rotação básica de logs
 */

const { app, BrowserWindow, shell, Menu, dialog, crashReporter, session } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

// P3-A8: desabilitar upload de crash reports (default em algumas versões enviava
// dumps para crashpad.googlepad.com). Dumps locais ainda gravam em
// app.getPath('crashDumps') para debugging.
try {
  crashReporter.start({ uploadToServer: false, productName: 'SoftHair', companyName: 'SoftHair' });
} catch (_) { /* api ausente em testes */ }

// P2-C1: módulo compartilhado para JWT secret. Mesma fonte que middleware/auth.js.
function getSecretsLib() {
  // Em prod, o backend foi copiado para resources/backend/. Em dev, repo direto.
  const candidates = [
    path.join(process.resourcesPath || '', 'backend', 'src', 'lib', 'secrets.js'),
    path.join(__dirname, '..', 'backend', 'src', 'lib', 'secrets.js'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return require(p);
    } catch (_) { /* skip */ }
  }
  return null;
}

let mainWindow;
let backendProcess;
let isQuitting = false;
const isDev = process.argv.includes('--dev');
const BACKEND_PORT = parseInt(process.env.SOFTHAIR_PORT, 10) || 3001;

// E11: single instance lock — primeiro Electron pega, segundo encerra.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function getResourcePath(relativePath) {
  // P3-M9: normalize para evitar mistakes em filesystem case-insensitive (macOS).
  if (isDev) {
    return path.normalize(path.join(__dirname, '..', relativePath));
  }
  if (app.isPackaged) {
    return path.normalize(path.join(process.resourcesPath, relativePath));
  }
  return path.normalize(path.join(__dirname, '..', relativePath));
}

// P2-C1/P2-C2/P2-B1/P2-B5: delega para o módulo compartilhado backend/src/lib/secrets.js
// Garante que main.js e backend embarcado leiam o MESMO arquivo, com write atomic.
function loadJwtSecret(dataDir) {
  const secretsLib = getSecretsLib();
  if (secretsLib && typeof secretsLib.resolveJwtSecret === 'function') {
    try {
      // P2-B5: em prod, falhar visivelmente se não conseguir persistir.
      const requirePersisted = app.isPackaged;
      return secretsLib.resolveJwtSecret({ dataDir, requirePersisted });
    } catch (e) {
      console.error('[Electron] Falha ao resolver JWT secret via lib:', e.message);
      if (app.isPackaged) {
        // P2-M9: usa safeShowError pra não crashar headless.
        safeShowError(
          'SoftHair',
          'Não foi possível persistir credenciais de segurança. Verifique permissões do diretório userData.'
        );
        app.exit(1);
      }
      // Em dev, gera efêmero.
      return crypto.randomBytes(32).toString('hex');
    }
  }
  // Fallback (extremamente improvável: secrets.js não encontrado).
  console.error('[Electron] secrets.js lib não encontrado. Usando fallback inline.');
  const secretsFile = path.join(dataDir, 'secrets.json');
  try {
    if (fs.existsSync(secretsFile)) {
      const cfg = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
      if (cfg.jwtSecret && cfg.jwtSecret.length >= 32) return cfg.jwtSecret;
    }
    // P2-B1: 32 bytes
    const generated = crypto.randomBytes(32).toString('hex');
    const tmp = secretsFile + '.' + process.pid + '.' + Date.now() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ jwtSecret: generated, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    try { fs.renameSync(tmp, secretsFile); } catch (_) {
      try { fs.unlinkSync(secretsFile); } catch (_) { /* noop */ }
      fs.renameSync(tmp, secretsFile);
    }
    try { fs.chmodSync(secretsFile, 0o600); } catch (_) { /* Windows */ }
    return generated;
  } catch (e) {
    console.error('[Electron] Falha ao carregar/gerar JWT secret:', e.message);
    return crypto.randomBytes(32).toString('hex');
  }
}

// E20: redact paths absolutos/secret-like de mensagens antes de mostrar em dialog
function sanitizeMessage(msg) {
  if (!msg) return 'Erro desconhecido';
  let s = String(msg);
  // remove paths absolutos
  s = s.replace(/(\/[\w\-./]+)/g, '<path>');
  s = s.replace(/([A-Z]:\\[^\s]+)/g, '<path>');
  // limita tamanho
  if (s.length > 300) s = s.slice(0, 300) + '...';
  return s;
}

// P2-M9 + P3-M8: showErrorBox crasha em ambiente sem display (CI/headless).
// Wrap robusto: tenta sempre, e fallback graceful para console.error.
function safeShowError(title, msg) {
  if (process.env.CI || process.env.HEADLESS) {
    console.error(`[${title}] ${msg}`);
    return;
  }
  try {
    dialog.showErrorBox(title, msg);
  } catch (e) {
    // P3-M8: app não pronto / display indisponível / qualquer outro problema.
    console.error(`[${title}] (showErrorBox falhou: ${e.message}) ${msg}`);
  }
}

// E21: append a log file em userData/logs/softhair-YYYY-MM-DD.log com rotação por tamanho.
function getLogPath() {
  try {
    return path.join(app.getPath('userData'), 'logs', `softhair-${new Date().toISOString().slice(0, 10)}.log`);
  } catch {
    return null;
  }
}

function appendLog(line) {
  const logPath = getLogPath();
  if (!logPath) return;
  try {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // rotação por tamanho (10MB)
    try {
      const st = fs.statSync(logPath);
      if (st.size > 10 * 1024 * 1024) {
        fs.renameSync(logPath, logPath + '.' + Date.now() + '.old');
      }
    } catch (_) { /* arquivo ainda não existe */ }
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
  } catch (_) { /* não-fatal */ }
}

// P2-M8: limpa arquivos `.old` com mais de 30 dias.
function purgeOldLogs() {
  try {
    const logPath = getLogPath();
    if (!logPath) return;
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 dias
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.old')) continue;
      const full = path.join(dir, file);
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs < cutoff) {
          fs.unlinkSync(full);
        }
      } catch (_) { /* skip */ }
    }
  } catch (_) { /* não-fatal */ }
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
    safeShowError('SoftHair', `Backend não encontrado em ${sanitizeMessage(serverPath)}`);
    return;
  }

  // E1: jwt secret estável entre execuções (caso env não venha de fora).
  const jwtSecret = process.env.JWT_SECRET || loadJwtSecret(dataDir);

  backendProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(BACKEND_PORT),
      HOST: '127.0.0.1',
      DATABASE_TYPE: process.env.DATABASE_TYPE || 'sqlite',
      SOFTHAIR_DATA_DIR: dataDir,
      JWT_SECRET: jwtSecret,
      // E8: 24h em vez de 30d
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
      // E4: não passamos mais SOFTHAIR_DEFAULT_ADMIN_*; bootstrap via UI.
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  backendProcess.on('error', (err) => {
    console.error('[Electron] Erro no backend:', err);
    appendLog(`[backend] error: ${err.message}`);
    if (!isQuitting) {
      safeShowError('SoftHair', `Falha ao iniciar backend: ${sanitizeMessage(err.message)}`);
    }
  });

  if (backendProcess.stdout) {
    backendProcess.stdout.on('data', (d) => {
      const line = d.toString();
      process.stdout.write(`[backend] ${line}`);
      appendLog(`[backend] ${line.trim()}`);
    });
  }
  if (backendProcess.stderr) {
    backendProcess.stderr.on('data', (d) => {
      const line = d.toString();
      process.stderr.write(`[backend:err] ${line}`);
      appendLog(`[backend:err] ${line.trim()}`);
    });
  }

  backendProcess.on('close', (code) => {
    console.log('[Electron] Backend encerrou com código:', code);
    appendLog(`[backend] close code=${code}`);
    if (!isQuitting && code !== 0) {
      safeShowError('SoftHair', 'O backend encerrou inesperadamente. Verifique os logs.');
    }
  });
}

function waitForBackend(retries, delay, cb) {
  http
    .get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
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
      sandbox: true,
      webSecurity: true,
      // P3-A3: spell check enviava palavras para servidor de tradução em algumas
      // versões. Desativado por privacidade — app processa CPF/email.
      spellcheck: false,
      // P4-M2: defensive — flags deprecadas explicitamente desligadas para clareza.
      // Em Electron 40 já são false por default, mas declarar evita regression em
      // forks/forks-of-config.
      enableRemoteModule: false,
      navigateOnDragDrop: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#ffffff',
  });

  // P3-A5: bloquear navegação por drag-and-drop de arquivo.
  // O renderer já está protegido por will-navigate (linha abaixo), mas vale
  // explicitamente deny will-attach-webview e drop event.
  mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());

  // P4-C2: em produção, bloquear DevTools (F12 / Ctrl+Shift+I / Ctrl+Shift+J / Cmd+Opt+I).
  // Razão: usuário com acesso físico ao PC ou malware que controla clipboard pode
  // executar JS arbitrário via console (bypass de CSP, leak de token em localStorage).
  // P4-C4: bloquear também Ctrl+R / Cmd+R (reload) em prod — venda em progresso
  // não pode ser perdida por acidente.
  // P4-A3: bloquear context menu (right-click "Inspecionar elemento").
  if (!isDev && app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const k = String(input.key || '').toLowerCase();
      // F12
      if (k === 'f12') { event.preventDefault(); return; }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools / inspect element)
      if (input.control && input.shift && (k === 'i' || k === 'j' || k === 'c')) {
        event.preventDefault();
        return;
      }
      // macOS: Cmd+Option+I, Cmd+Option+J
      if (input.meta && input.alt && (k === 'i' || k === 'j')) {
        event.preventDefault();
        return;
      }
      // Ctrl+R / Cmd+R (reload — pode perder state)
      if ((input.control || input.meta) && k === 'r' && !input.shift) {
        event.preventDefault();
        return;
      }
      // Ctrl+Shift+R (force reload)
      if ((input.control || input.meta) && input.shift && k === 'r') {
        event.preventDefault();
        return;
      }
    });
    // P4-A3: bloquear context menu nativo (Chromium expõe "Inspecionar elemento")
    mainWindow.webContents.on('context-menu', (e) => e.preventDefault());
    // P4-C2: defesa em profundidade — se algo conseguir abrir DevTools, fecha imediato
    mainWindow.webContents.on('devtools-opened', () => {
      try { mainWindow.webContents.closeDevTools(); } catch (_) { /* noop */ }
    });
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // E15: setWindowOpenHandler — bloqueia tudo, manda https/http pro browser externo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      try {
        const u = new URL(url);
        if (
          u.protocol === 'https:' ||
          (u.protocol === 'http:' &&
            (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
        ) {
          shell.openExternal(url).catch(() => {});
        }
      } catch (_) { /* invalid url */ }
    }
    return { action: 'deny' };
  });

  if (isDev) {
    const devURL = 'http://localhost:3000';
    mainWindow.loadURL(devURL).catch((err) => {
      safeShowError('SoftHair', `Erro ao carregar dev URL: ${sanitizeMessage(err.message)}`);
    });
    mainWindow.webContents.openDevTools();

    // E15: bloquear navegação fora do dev URL ou do backend local
    mainWindow.webContents.on('will-navigate', (event, url) => {
      try {
        const u = new URL(url);
        const allowed =
          url.startsWith(devURL) ||
          (u.hostname === '127.0.0.1' && String(u.port) === String(BACKEND_PORT)) ||
          (u.hostname === 'localhost' && String(u.port) === String(BACKEND_PORT));
        if (!allowed) {
          event.preventDefault();
        }
      } catch (_) {
        event.preventDefault();
      }
    });
  } else {
    const indexPath = getResourcePath(path.join('frontend', 'dist', 'index.html'));
    const indexURL = 'file://' + indexPath;

    // E15: bloquear navegação que não seja para o indexURL (file://...)
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(indexURL)) {
        event.preventDefault();
      }
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -6 && validatedURL && validatedURL.startsWith('file://') && !validatedURL.startsWith(indexURL)) {
        mainWindow.loadFile(indexPath).catch(() => {});
      }
    });

    mainWindow.loadFile(indexPath).catch(() => {
      safeShowError('SoftHair', 'Não foi possível carregar a interface. Rode `npm run build:frontend`.');
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // P2-M4: usa send/IPC em vez de executeJavaScript inline (evita injection
  // surface se algum dia o `route` vier de input do usuário).
  const navigate = (route) => {
    if (mainWindow && typeof route === 'string' && /^[\/A-Za-z0-9_-]+$/.test(route)) {
      mainWindow.webContents.send('navigate', route);
    }
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
      // P4-C4: em produção, NÃO incluir `reload` no menu — usuário pode perder
      // estado in-memory (venda em progresso, agendamento sendo editado).
      // Reload continua disponível em dev.
      submenu: (isDev || !app.isPackaged)
        ? [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }]
        : [{ role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }],
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

// Crash handler — E21
process.on('uncaughtException', (err) => {
  console.error('[Electron] uncaughtException:', err);
  appendLog(`[main] uncaughtException: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Electron] unhandledRejection:', reason);
  appendLog(`[main] unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});

// P4-M3: bloquear flags como --no-sandbox vindas via injection externa.
// Algumas extensões/AV injetam flags Chromium para "compatibilidade", desativando
// sandbox. Em produção, recusar inicialização.
if (app.isPackaged) {
  const dangerousFlags = ['--no-sandbox', '--disable-web-security', '--allow-running-insecure-content'];
  const argv = process.argv || [];
  for (const flag of dangerousFlags) {
    if (argv.includes(flag)) {
      console.error(`[Electron] Flag perigosa detectada: ${flag}. Abortando.`);
      // Tenta avisar visualmente; se não conseguir, exit silencioso.
      try {
        require('electron').dialog.showErrorBox(
          'SoftHair',
          `Inicialização abortada: flag não permitida (${flag}). Reinstale o aplicativo de fonte oficial.`
        );
      } catch (_) { /* noop */ }
      process.exit(1);
    }
  }
}

// P4-A2: limpa crash dumps antigos (> 30 dias). Dumps de Chromium podem ter
// 50-500MB cada. Sem cleanup, crescem indefinidamente.
function purgeOldCrashDumps() {
  try {
    const dir = app.getPath('crashDumps');
    if (!fs.existsSync(dir)) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const walk = (d) => {
      for (const entry of fs.readdirSync(d)) {
        const full = path.join(d, entry);
        try {
          const st = fs.statSync(full);
          if (st.isDirectory()) { walk(full); continue; }
          if (st.mtimeMs < cutoff) fs.unlinkSync(full);
        } catch (_) { /* skip */ }
      }
    };
    walk(dir);
  } catch (_) { /* não-fatal */ }
}

app.whenReady().then(() => {
  // P2-A1: expor isPackaged via env para o preload (process.env.ELECTRON_IS_PACKAGED).
  process.env.ELECTRON_IS_PACKAGED = String(!!app.isPackaged);

  // P2-M8 + P3-M7: limpar logs antigos no boot (deferido para não bloquear startup).
  // P4-A2: junto, limpa crash dumps antigos.
  setTimeout(() => {
    purgeOldLogs();
    purgeOldCrashDumps();
  }, 5000);

  // P3-A4: webRequest filter — bloqueia tudo que não seja loopback ou file://.
  // Defesa em profundidade junto com CSP. Combinado com BrowserWindow webSecurity:true.
  // P4-M7: permite font https externa (caso CSS futuro use Google Fonts).
  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      const url = details.url || '';
      const ok =
        url.startsWith('file://') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('http://localhost') ||
        url.startsWith('https://127.0.0.1') ||
        url.startsWith('https://localhost') ||
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        // imgs externas (https) — CSP já filtra mas webRequest libera para img-src
        (details.resourceType === 'image' && url.startsWith('https://')) ||
        // P4-M7: fonts externas via https (defesa em profundidade contra CSP futura)
        (details.resourceType === 'font' && url.startsWith('https://'));
      callback({ cancel: !ok });
    });
  } catch (e) {
    console.warn('[Electron] webRequest filter setup falhou:', e.message);
  }

  if (!isDev) {
    startBackend();
    waitForBackend(60, 500, createWindow);
  } else {
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  isQuitting = true;
  if (backendProcess) {
    try {
      backendProcess.kill('SIGTERM');
      setTimeout(() => {
        try { backendProcess.kill('SIGKILL'); } catch (_) { /* já morto */ }
      }, 2000);
    } catch (_) { /* noop */ }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (backendProcess) {
    try {
      backendProcess.kill('SIGTERM');
      setTimeout(() => {
        try { backendProcess.kill('SIGKILL'); } catch (_) { /* já morto */ }
      }, 2000);
    } catch (_) { /* noop */ }
  }
});
