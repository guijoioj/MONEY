const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const BackupService = require('../services/backupService');
const GoogleDriveService = require('../services/googleDriveService');
const { authMiddleware } = require('../middleware/auth');
const { getPaths, ensureRuntimeDirs } = require('../config/appPaths');

const appPaths = getPaths();
ensureRuntimeDirs(appPaths);

router.use(authMiddleware);

const upload = multer({
  dest: appPaths.tempUploadDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JSON são permitidos'));
    }
  }
});

router.post('/create', async (req, res) => {
  try {
    const backup = await BackupService.createBackup();
    res.json({ message: 'Backup criado com sucesso', backup });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/local', (req, res) => {
  try {
    const backups = BackupService.getLocalBackups();
    res.json({ data: backups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/restore', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo de backup é obrigatório' });
    }
    const result = await BackupService.restoreBackup(req.file.path);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/restore/:filename', async (req, res) => {
  try {
    const backups = BackupService.getLocalBackups();
    const backup = backups.find(b => b.filename === req.params.filename);
    if (!backup) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }
    const result = await BackupService.restoreBackup(backup.filepath);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/google/config', (req, res) => {
  try {
    const { clientId, clientSecret, redirectUri } = req.body;
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID e Client Secret são obrigatórios' });
    }

    const configPath = appPaths.googleDriveConfigPath;
    const configDir = path.dirname(configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = {
      clientId,
      clientSecret,
      redirectUri: redirectUri || 'http://localhost:3001/auth/google/callback',
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    GoogleDriveService.loadConfig();
    
    res.json({ message: 'Configurações do Google Drive salvas com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google/config', (req, res) => {
  try {
    const configPath = appPaths.googleDriveConfigPath;
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      res.json({ 
        hasConfig: true,
        clientId: config.clientId,
        clientSecret: config.clientSecret ? '***' : null
      });
    } else {
      res.json({ hasConfig: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google/auth-url', (req, res) => {
  try {
    const authUrl = GoogleDriveService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message, message: 'Configure o Client ID e Client Secret nas configurações' });
  }
});

router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;
    const tokens = await GoogleDriveService.getTokenFromCode(code);
    res.json({ message: 'Autenticado com sucesso no Google Drive', tokens });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/google/status', (req, res) => {
  try {
    const isAuthenticated = GoogleDriveService.isAuthenticated();
    res.json({ authenticated: isAuthenticated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/google/sync/:filename', async (req, res) => {
  try {
    const backups = BackupService.getLocalBackups();
    const backup = backups.find(b => b.filename === req.params.filename);
    if (!backup) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }
    const result = await BackupService.syncToCloud(backup);
    res.json({ message: 'Backup sincronizado com sucesso', cloudId: result.cloudId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google/files', async (req, res) => {
  try {
    const files = await GoogleDriveService.listFiles();
    res.json({ data: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google/disconnect', (req, res) => {
  try {
    GoogleDriveService.disconnect();
    res.json({ message: 'Desconectado do Google Drive com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/cloud', (req, res) => {
  try {
    const backups = BackupService.getCloudBackups();
    res.json({ data: backups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
