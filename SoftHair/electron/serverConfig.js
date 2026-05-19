/**
 * serverConfig — gerencia URL do servidor escolhida pelo usuário.
 *
 * Persiste em <userData>/server-config.json.
 *
 * Modos:
 *   - 'embarcado' : usa backend SQLite local (default, primeira execução)
 *   - 'local'     : aponta pro IP do PC servidor no salão (cérebro)
 *   - 'render'    : aponta pra https://money-f5rz.onrender.com
 *   - 'custom'    : URL livre
 *
 * @module electron/serverConfig
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'server-config.json');

const DEFAULTS = {
  mode: 'embarcado',
  url: 'http://127.0.0.1:3001',
};

const PRESETS = {
  embarcado: 'http://127.0.0.1:3001',
  local: 'http://192.168.1.10:3001',
  render: 'https://money-f5rz.onrender.com',
};

function load() {
  try {
    const file = CONFIG_FILE();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const cfg = JSON.parse(raw);
      // sanity-check
      if (cfg && typeof cfg.mode === 'string' && typeof cfg.url === 'string') {
        return cfg;
      }
    }
  } catch (e) {
    console.warn('[serverConfig] erro ao carregar:', e.message);
  }
  return { ...DEFAULTS };
}

function save(cfg) {
  try {
    const file = CONFIG_FILE();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2), { encoding: 'utf8' });
    return true;
  } catch (e) {
    console.error('[serverConfig] erro ao salvar:', e.message);
    return false;
  }
}

function shouldStartEmbeddedBackend() {
  const cfg = load();
  return cfg.mode === 'embarcado';
}

function getApiUrl() {
  const cfg = load();
  return cfg.url;
}

module.exports = {
  load,
  save,
  shouldStartEmbeddedBackend,
  getApiUrl,
  PRESETS,
  CONFIG_FILE,
};
