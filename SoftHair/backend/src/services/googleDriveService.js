const { google } = require('googleapis');
const fs = require('fs');
const { getPaths } = require('../config/appPaths');

const { googleDriveConfigPath, googleDriveTokensPath, configDir } = getPaths();

class GoogleDriveService {
  static oauth2Client;
  static drive;
  static config;

  static getConfig() {
    if (this.config) return this.config;

    const configPath = googleDriveConfigPath;
    
    if (fs.existsSync(configPath)) {
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return this.config;
    }

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.config = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
      };
      return this.config;
    }

    throw new Error('Google Drive não configurado. Configure o Client ID e Client Secret nas configurações.');
  }

  static loadConfig() {
    this.config = null;
    this.oauth2Client = null;
    this.drive = null;
    return this.getConfig();
  }

  static getOAuth2Client() {
    if (!this.oauth2Client) {
      const config = this.getConfig();
      this.oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );
    }
    return this.oauth2Client;
  }

  static getDriveClient() {
    if (!this.drive) {
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    }
    return this.drive;
  }

  static loadTokens() {
    if (fs.existsSync(googleDriveTokensPath)) {
      const tokens = JSON.parse(fs.readFileSync(googleDriveTokensPath, 'utf-8'));
      this.getOAuth2Client().setCredentials(tokens);
      return true;
    }
    return false;
  }

  static saveTokens(tokens) {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(googleDriveTokensPath, JSON.stringify(tokens, null, 2));
    this.getOAuth2Client().setCredentials(tokens);
  }

  static getAuthUrl() {
    const config = this.getConfig();
    const SCOPES = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata'
    ];
    
    const oauth2Client = this.getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    return authUrl;
  }

  static async getTokenFromCode(code) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    this.saveTokens(tokens);
    return tokens;
  }

  static isAuthenticated() {
    try {
      this.loadTokens();
      const credentials = this.getOAuth2Client().credentials;
      return !!(credentials && credentials.access_token);
    } catch (error) {
      return false;
    }
  }

  static disconnect() {
    const tokensPath = googleDriveTokensPath;
    if (fs.existsSync(tokensPath)) {
      fs.unlinkSync(tokensPath);
    }
    this.oauth2Client = null;
    this.drive = null;
  }

  static async uploadFile(filepath, filename) {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Google Drive');
    }

    const drive = this.getDriveClient();
    
    const requestBody = {
      name: filename,
      parents: ['appDataFolder']
    };

    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(filepath)
    };

    const response = await drive.files.create({
      requestBody,
      media,
      fields: 'id, name, createdTime, size'
    });

    return response.data.id;
  }

  static async downloadFile(fileId) {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Google Drive');
    }

    const drive = this.getDriveClient();
    
    const response = await drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });

    return new Promise((resolve, reject) => {
      let data = '';
      response.data.on('data', chunk => data += chunk);
      response.data.on('end', () => resolve(data));
      response.data.on('error', reject);
    });
  }

  static async listFiles() {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Google Drive');
    }

    const drive = this.getDriveClient();
    
    const response = await drive.files.list({
      q: "name contains 'backup_' and trashed = false",
      fields: 'files(id, name, createdTime, size, mimeType)',
      spaces: 'appDataFolder',
      orderBy: 'createdTime desc'
    });

    return response.data.files || [];
  }

  static async deleteFile(fileId) {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Google Drive');
    }

    const drive = this.getDriveClient();
    await drive.files.delete({ fileId });
    return true;
  }

  static async createFolder(folderName) {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Google Drive');
    }

    const drive = this.getDriveClient();
    
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['appDataFolder']
      },
      fields: 'id, name'
    });

    return response.data;
  }

  static async findOrCreateFolder(folderName) {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Google Drive');
    }

    const drive = this.getDriveClient();
    
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'appDataFolder',
      fields: 'files(id, name)'
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0];
    }

    return await this.createFolder(folderName);
  }
}

GoogleDriveService.loadTokens();

module.exports = GoogleDriveService;
