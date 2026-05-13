/**
 * SyncService — sincronização bidirecional opcional com Render.
 *
 * Modos:
 *   - desabilitado (default): tudo local em SQLite
 *   - habilitado: push de mudanças locais + pull de mudanças remotas a cada 30s
 *
 * Config persistida em arquivo JSON (sync-config.json) ao lado do db.
 * Em produção o usuário ativa via UI (/sync).
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { query, queryOne, queryRun, dbType } = require('../config/database');

const CONFIG_FILE = path.join(
  process.env.SOFTHAIR_DATA_DIR ||
    path.join(__dirname, '..', '..', 'database'),
  'sync-config.json'
);

const SYNC_TABLES = [
  'clientes',
  'profissionais',
  'servicos',
  'produtos',
  'agendamentos',
  'atendimentos',
  'vendas',
];

class SyncService {
  constructor() {
    this.cloudUrl = null;
    this.token = null;
    this.enabled = false;
    this.interval = null;
    this.lastSync = null;
    this.lastError = null;
    this.syncing = false;

    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        this.cloudUrl = cfg.cloudUrl || null;
        this.token = cfg.token || null;
        this.enabled = !!cfg.enabled;
        this.lastSync = cfg.lastSync || null;
        if (this.enabled && this.cloudUrl && this.token) {
          this.start();
        }
      }
    } catch (e) {
      console.error('[SyncService] Falha ao carregar config:', e.message);
    }
  }

  saveConfig() {
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(
          {
            cloudUrl: this.cloudUrl,
            token: this.token,
            enabled: this.enabled,
            lastSync: this.lastSync,
          },
          null,
          2
        )
      );
    } catch (e) {
      console.error('[SyncService] Falha ao salvar config:', e.message);
    }
  }

  configure({ cloudUrl, token, enabled }) {
    if (cloudUrl !== undefined) this.cloudUrl = cloudUrl;
    if (token !== undefined) this.token = token;
    if (enabled !== undefined) this.enabled = !!enabled;

    if (this.enabled && this.cloudUrl && this.token) {
      this.start();
    } else {
      this.stop();
    }
    this.saveConfig();
  }

  start() {
    if (this.interval) clearInterval(this.interval);
    const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS) || 30000;
    this.interval = setInterval(() => this.syncNow().catch(() => {}), intervalMs);
    setImmediate(() => this.syncNow().catch(() => {}));
    console.log(`[SyncService] Iniciado (intervalo ${intervalMs}ms)`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    console.log('[SyncService] Parado');
  }

  async syncNow() {
    if (this.syncing) return { skipped: true, reason: 'já em andamento' };
    if (!this.enabled || !this.cloudUrl || !this.token) {
      return { skipped: true, reason: 'desabilitado ou não configurado' };
    }

    this.syncing = true;
    try {
      const since = this.lastSync || '1970-01-01T00:00:00';

      // PUSH local → remote
      const localChanges = await this.collectLocalChanges(since);
      const totalLocal = Object.values(localChanges).reduce((s, arr) => s + arr.length, 0);

      if (totalLocal > 0) {
        await axios.post(
          `${this.cloudUrl}/sync/push`,
          { since, changes: localChanges },
          {
            headers: { Authorization: `Bearer ${this.token}` },
            timeout: 15000,
          }
        );
      }

      // PULL remote → local
      const remoteRes = await axios.get(`${this.cloudUrl}/sync/changes`, {
        params: { since },
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 15000,
      });
      const remoteChanges = remoteRes.data?.data || remoteRes.data || {};
      const totalRemote = await this.applyRemoteChanges(remoteChanges);

      this.lastSync = new Date().toISOString();
      this.lastError = null;
      this.saveConfig();

      return { success: true, pushed: totalLocal, pulled: totalRemote, at: this.lastSync };
    } catch (error) {
      this.lastError = error.message;
      console.error('[SyncService] Erro:', error.message);
      return { success: false, error: error.message };
    } finally {
      this.syncing = false;
    }
  }

  async collectLocalChanges(since) {
    const changes = {};
    for (const t of SYNC_TABLES) {
      try {
        const rows = await query(
          `SELECT * FROM ${t} WHERE updated_at > ? OR (updated_at IS NULL AND created_at > ?)`,
          [since, since]
        );
        changes[t] = rows;
      } catch (e) {
        // Tabela pode não existir
        changes[t] = [];
      }
    }
    return changes;
  }

  async applyRemoteChanges(changes) {
    let total = 0;
    for (const [table, rows] of Object.entries(changes || {})) {
      if (!Array.isArray(rows) || !SYNC_TABLES.includes(table)) continue;
      for (const row of rows) {
        try {
          await this.upsertRow(table, row);
          total++;
        } catch (e) {
          console.error(`[SyncService] Erro ao aplicar ${table}#${row.id}:`, e.message);
        }
      }
    }
    return total;
  }

  async upsertRow(table, row) {
    const existing = await queryOne(`SELECT id FROM ${table} WHERE id = ?`, [row.id]);
    const cols = Object.keys(row);
    if (existing) {
      const sets = cols.filter((c) => c !== 'id').map((c) => `${c} = ?`);
      const values = cols.filter((c) => c !== 'id').map((c) => row[c]);
      values.push(row.id);
      await queryRun(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, values);
    } else {
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => row[c]);
      await queryRun(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
        values
      );
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      configured: !!(this.cloudUrl && this.token),
      cloudUrl: this.cloudUrl,
      hasToken: !!this.token,
      lastSync: this.lastSync,
      lastError: this.lastError,
      syncing: this.syncing,
      dbType,
    };
  }
}

module.exports = new SyncService();
