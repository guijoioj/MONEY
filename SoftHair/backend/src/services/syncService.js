/**
 * SyncService — sincronização bidirecional opcional com Render.
 *
 * Modos:
 *   - desabilitado (default): tudo local em SQLite
 *   - habilitado: push de mudanças locais + pull de mudanças remotas a cada 30s
 *
 * Config persistida em arquivo JSON (sync-config.json) ao lado do db.
 * Em produção o usuário ativa via UI (/sync).
 *
 * Segurança (Pass 1):
 *   - E2: token criptografado em disco com chave derivada (HMAC-SHA256 do JWT_SECRET).
 *   - E2: arquivo com permissão 0o600 (chmod best-effort em Windows).
 *   - E2: TTL token Render reduzido (gerenciado via JWT_EXPIRES_IN no server).
 *   - E3: cloudUrl deve ser https:// (exceto loopback). axios usa rejectUnauthorized:true.
 *   - E5: contrato push corrigido — emite [{table, operation, data}].
 *   - E6: applyRemoteChanges valida salao_id e usa allowlist de colunas.
 *   - E9: disconnect() limpa token + cloudUrl + lastSync.
 *   - E18: mutex via promise para sync simultâneo.
 *   - E25: intervalo mínimo 10s.
 */

const axios = require('axios');
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query, queryOne, queryRun, dbType } = require('../config/database');

const DATA_DIR =
  process.env.SOFTHAIR_DATA_DIR || path.join(__dirname, '..', '..', 'database');

const CONFIG_FILE = path.join(DATA_DIR, 'sync-config.json');

// Tabelas autorizadas no sync — devem espelhar TABLE_COLUMNS abaixo
const SYNC_TABLES = [
  'clientes',
  'profissionais',
  'servicos',
  'produtos',
  'agendamentos',
  'atendimentos',
  'vendas',
];

// E6: whitelist de colunas por tabela. NUNCA inclui senha_hash, app_ativo.
// salao_id é tratado separadamente para validar tenant isolation.
const TABLE_COLUMNS = {
  clientes: [
    'id', 'salao_id', 'nome', 'telefone', 'email', 'cpf', 'endereco',
    'data_nascimento', 'observacoes', 'foto_url', 'credito_disponivel',
    'ativo', 'created_at', 'updated_at',
  ],
  profissionais: [
    'id', 'salao_id', 'nome', 'telefone', 'email', 'cpf', 'especialidade',
    'comissao_percentual', 'foto_url', 'ativo', 'created_at', 'updated_at',
    // INTENCIONALMENTE OMITIDOS: senha_hash, app_ativo
  ],
  servicos: [
    'id', 'salao_id', 'nome', 'descricao', 'preco', 'duracao_minutos',
    'comissao_percentual', 'cor', 'ativo', 'created_at', 'updated_at',
  ],
  produtos: [
    'id', 'salao_id', 'nome', 'descricao', 'preco_custo', 'preco_venda',
    'quantidade_estoque', 'quantidade_minima', 'categoria', 'codigo_barras',
    'ativo', 'created_at', 'updated_at',
  ],
  agendamentos: [
    'id', 'salao_id', 'cliente_id', 'profissional_id', 'servico_id',
    'data_hora', 'duracao_minutos', 'status', 'observacoes', 'valor',
    'created_at', 'updated_at',
  ],
  atendimentos: [
    'id', 'salao_id', 'cliente_id', 'profissional_id', 'servico_id',
    'agendamento_id', 'valor', 'status', 'observacoes',
    'created_at', 'updated_at',
  ],
  vendas: [
    'id', 'salao_id', 'cliente_id', 'profissional_id', 'tipo', 'status',
    'valor_total', 'desconto', 'valor_final', 'forma_pagamento',
    'observacoes', 'created_at', 'updated_at',
  ],
};

function sanitizeRow(table, row) {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed || !row || typeof row !== 'object') return null;
  const out = {};
  for (const k of Object.keys(row)) {
    if (allowed.includes(k)) out[k] = row[k];
  }
  return out;
}

// E3: aceita https://, ou loopback http://127.0.0.1/localhost em dev
function isValidCloudUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') {
      const h = u.hostname;
      return (
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '::1' ||
        h.endsWith('.localhost')
      );
    }
    return false;
  } catch {
    return false;
  }
}

// E2: criptografia simétrica usando chave derivada do JWT_SECRET. Cria pacote
// {iv, tag, ct} para AES-256-GCM. Em ambientes onde Electron expõe safeStorage
// pode-se substituir por essa API; o método atual mantém o arquivo plaintext
// fora do disco e exige conhecer JWT_SECRET (que vive em secrets.json 0o600).
//
// P2-C3: NUNCA cair em fallback string ('fallback') — gera chave previsível
// que qualquer atacante com o sync-config.json descriptografa instantaneamente.
function getEncryptionKey() {
  const { JWT_SECRET } = require('../middleware/auth');
  if (!JWT_SECRET || typeof JWT_SECRET !== 'string' || JWT_SECRET.length < 32) {
    const err = new Error('JWT_SECRET ausente — token criptografia indisponível');
    err.code = 'NO_JWT_SECRET';
    throw err;
  }
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update('softhair-sync-token-v1')
    .digest();
}

function encryptToken(plain) {
  if (!plain) return null;
  try {
    const key = getEncryptionKey(); // P2-C3: throw se JWT_SECRET ausente
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ct.toString('base64'),
    };
  } catch (e) {
    // P2-C3: se a key não existe, NÃO grava token plaintext — retorna null
    // e o caller deve decidir (a config será salva sem token, forçando
    // re-login no cloud na próxima inicialização).
    console.error('[SyncService] Falha ao criptografar token:', e.message);
    return null;
  }
}

function decryptToken(enc) {
  if (!enc) return null;
  // P2-C3: compat string removido — token antigo plaintext é REJEITADO
  // (não confiar em plaintext sem encrypt). Usuário precisa reconectar.
  if (typeof enc === 'string') {
    console.warn('[SyncService] Token cloud em formato legado (plaintext) descartado — reconecte.');
    return null;
  }
  if (typeof enc !== 'object' || !enc.iv || !enc.tag || !enc.ct) return null;
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(enc.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(enc.ct, 'base64')),
      decipher.final(),
    ]);
    return pt.toString('utf8');
  } catch (e) {
    console.error('[SyncService] Falha ao descriptografar token:', e.message);
    return null;
  }
}

class SyncService {
  constructor() {
    this.cloudUrl = null;
    this.token = null;
    this.enabled = false;
    this.interval = null;
    this.lastSync = null;
    this.lastError = null;
    this.syncing = false;
    this.syncPromise = null; // E18: mutex
    // P2-C5: salao_id resolvido em runtime (do JWT cloud ou do DB local).
    // Hardcoded 1 era inválido quando admin troca de salão ou faz restore.
    this._localSalaoId = null;
    this.knownFingerprint = null; // P2-C6: TOFU fingerprint do cert

    this.loadConfig();
  }

  // P2-C5: resolve salao_id local do banco (single-tenant local) ou do JWT cloud.
  // Cacheia o resultado para evitar query a cada pull.
  getLocalSalaoId() {
    if (this._localSalaoId) return this._localSalaoId;
    try {
      // Estratégia 1: tenta extrair do JWT cloud (mais autoritativo).
      if (this.token) {
        const parts = this.token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.salaoId) {
            this._localSalaoId = Number(payload.salaoId);
            return this._localSalaoId;
          }
        }
      }
    } catch (_) { /* JWT inválido, cai pro fallback */ }
    try {
      // Estratégia 2: primeiro salão do banco local.
      const row = queryOne(`SELECT id FROM saloes ORDER BY id LIMIT 1`);
      if (row && row.id) {
        this._localSalaoId = Number(row.id);
        return this._localSalaoId;
      }
    } catch (e) {
      console.error('[SyncService] Falha ao resolver localSalaoId do DB:', e.message);
    }
    // Fallback final.
    this._localSalaoId = 1;
    return this._localSalaoId;
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        this.cloudUrl = cfg.cloudUrl || null;
        this.token = decryptToken(cfg.token);
        this.enabled = !!cfg.enabled;
        this.lastSync = cfg.lastSync || null;
        this.knownFingerprint = cfg.fingerprint || null;
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
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const payload = {
        cloudUrl: this.cloudUrl,
        token: this.token ? encryptToken(this.token) : null,
        enabled: this.enabled,
        lastSync: this.lastSync,
        fingerprint: this.knownFingerprint || null,
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
      // best-effort chmod (Windows ignora)
      try { fs.chmodSync(CONFIG_FILE, 0o600); } catch (_) { /* noop */ }
    } catch (e) {
      console.error('[SyncService] Falha ao salvar config:', e.message);
    }
  }

  configure({ cloudUrl, token, enabled }) {
    if (cloudUrl !== undefined) {
      // E3: rejeita URLs não-HTTPS (exceto loopback)
      if (cloudUrl && !isValidCloudUrl(cloudUrl)) {
        const err = new Error('cloudUrl deve usar HTTPS (ou loopback em dev)');
        err.code = 'INVALID_CLOUD_URL';
        throw err;
      }
      // Reset fingerprint se url mudou
      if (this.cloudUrl && this.cloudUrl !== cloudUrl) {
        this.knownFingerprint = null;
      }
      this.cloudUrl = cloudUrl;
    }
    if (token !== undefined) {
      this.token = token;
      // P2-C5: invalidar cache do salao_id — pode vir de JWT diferente.
      this._localSalaoId = null;
    }
    if (enabled !== undefined) this.enabled = !!enabled;

    if (this.enabled && this.cloudUrl && this.token) {
      this.start();
    } else {
      this.stop();
    }
    this.saveConfig();
  }

  /**
   * E9 + P2-B4: desconectar — limpa todos os campos de credencial em memória,
   * e remove o arquivo do disco (em vez de escrever '{}') — não deixa rastro.
   */
  disconnect() {
    this.stop();
    this.cloudUrl = null;
    this.token = null;
    this.enabled = false;
    this.lastSync = null;
    this.lastError = null;
    this.knownFingerprint = null;
    this._pendingFingerprint = null;
    this._localSalaoId = null;
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }
    } catch (e) {
      console.error('[SyncService] Falha ao limpar config:', e.message);
      // fallback: sobrescreve com {} se unlink falhar
      try {
        fs.writeFileSync(CONFIG_FILE, '{}', { mode: 0o600 });
        try { fs.chmodSync(CONFIG_FILE, 0o600); } catch (_) { /* noop */ }
      } catch (_) { /* noop */ }
    }
  }

  start() {
    if (this.interval) clearInterval(this.interval);
    // E25: clamp mínimo 10s
    const intervalMs = Math.max(parseInt(process.env.SYNC_INTERVAL_MS) || 30000, 10000);
    this.interval = setInterval(() => this.syncNow().catch(() => {}), intervalMs);
    setImmediate(() => this.syncNow().catch(() => {}));
    console.log(`[SyncService] Iniciado (intervalo ${intervalMs}ms)`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    console.log('[SyncService] Parado');
  }

  // E3 + P2-C6: axios com TLS forçado E TOFU fingerprint do cert.
  // No primeiro sync sucesso, grava fingerprint256 do peer cert. Nas próximas
  // requisições, compara — se mudou, aborta e exige reconexão.
  buildAxiosConfig() {
    const agent = new https.Agent({
      rejectUnauthorized: true, // E3: NUNCA aceita cert inválido
      // P2-C6: hook para capturar fingerprint do peer cert.
      checkServerIdentity: (host, cert) => {
        const tls = require('tls');
        const defaultCheck = tls.checkServerIdentity(host, cert);
        if (defaultCheck) return defaultCheck; // hostname mismatch / SAN
        const fp = cert.fingerprint256;
        if (this.knownFingerprint) {
          if (this.knownFingerprint !== fp) {
            return new Error(
              `Cert fingerprint mudou (TOFU): conhecido=${this.knownFingerprint.slice(0, 16)}... atual=${fp.slice(0, 16)}... — reconecte`
            );
          }
        } else {
          // Trust on First Use — grava na próxima saveConfig.
          this._pendingFingerprint = fp;
        }
        return undefined; // OK
      },
    });
    return {
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 15000,
      httpsAgent: agent,
    };
  }

  /**
   * E18: mutex via promise — reentrante seguro.
   */
  async syncNow() {
    if (this.syncPromise) return this.syncPromise;
    if (!this.enabled || !this.cloudUrl || !this.token) {
      return { skipped: true, reason: 'desabilitado ou não configurado' };
    }
    // E3: validar URL antes de fazer request
    if (!isValidCloudUrl(this.cloudUrl)) {
      this.lastError = 'cloudUrl inválida (apenas HTTPS ou loopback)';
      return { success: false, error: this.lastError };
    }

    this.syncing = true;
    this.syncPromise = this._doSync().finally(() => {
      this.syncing = false;
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  async _doSync() {
    try {
      const since = this.lastSync || '1970-01-01T00:00:00';
      const cfg = this.buildAxiosConfig();

      // PUSH local → remote (E5: formato [{table, operation, data}])
      const changes = await this.collectLocalChanges(since);

      if (changes.length > 0) {
        // E6 + E16: dividir em batches de 100 (limit do server)
        const BATCH = 100;
        for (let i = 0; i < changes.length; i += BATCH) {
          const batch = changes.slice(i, i + BATCH);
          await axios.post(`${this.cloudUrl}/sync/push`, { changes: batch }, cfg);
        }
      }

      // PULL remote → local
      const remoteRes = await axios.get(`${this.cloudUrl}/sync/changes`, {
        ...cfg,
        params: { since },
      });
      const remoteChanges = remoteRes.data?.data || remoteRes.data || {};
      const totalRemote = await this.applyRemoteChanges(remoteChanges);

      // P2-C6: commit fingerprint capturado em TOFU.
      if (this._pendingFingerprint && !this.knownFingerprint) {
        this.knownFingerprint = this._pendingFingerprint;
        console.log(`[SyncService] TOFU fingerprint gravado: ${this.knownFingerprint.slice(0, 16)}...`);
      }
      this._pendingFingerprint = null;

      this.lastSync = new Date().toISOString();
      this.lastError = null;
      this.saveConfig();

      return { success: true, pushed: changes.length, pulled: totalRemote, at: this.lastSync };
    } catch (error) {
      // P2-A8: 401/403 — token expirado/inválido. Desabilitar sync para evitar
      // loop infinito de retries. UI deve mostrar reconnect.
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        this.enabled = false;
        this.lastError = `Token cloud expirado ou inválido (HTTP ${status}) — reconecte`;
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        this.saveConfig();
        console.warn('[SyncService] Auth falhou, sync desabilitado:', this.lastError);
        return { success: false, error: this.lastError, requiresReauth: true };
      }
      this.lastError = error.message;
      console.error('[SyncService] Erro:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * E5: emite formato granular [{table, operation, data}] esperado pelo server cloud.
   *     `operation` é derivado heuristicamente: 'INSERT' se created_at > since,
   *     senão 'UPDATE'. (DELETE seria via sync_log mas é skip por ora.)
   */
  async collectLocalChanges(since) {
    const out = [];
    for (const t of SYNC_TABLES) {
      try {
        // E4: SELECT explícito por allowlist (em vez de SELECT *)
        const cols = TABLE_COLUMNS[t].join(', ');
        const rows = await query(
          `SELECT ${cols} FROM ${t} WHERE updated_at > ? OR (updated_at IS NULL AND created_at > ?)`,
          [since, since]
        );
        for (const row of rows) {
          const data = sanitizeRow(t, row);
          if (!data) continue;
          const isNew = !row.updated_at || row.created_at === row.updated_at;
          const operation = isNew && row.created_at > since ? 'INSERT' : 'UPDATE';
          // E16: normalizar boolean
          if ('ativo' in data) data.ativo = data.ativo ? true : false;
          out.push({ table: t, operation, data });
        }
      } catch (e) {
        console.error(`[SyncService] collectLocalChanges erro em ${t}:`, e.message);
      }
    }
    return out;
  }

  /**
   * E6: aplica mudanças remotas com:
   *   - validação que `salao_id` (se presente) é do salão local
   *   - allowlist de colunas (sanitizeRow)
   *   - rejeição se a tabela não está em SYNC_TABLES
   */
  async applyRemoteChanges(changes) {
    let total = 0;
    for (const [table, rows] of Object.entries(changes || {})) {
      if (!Array.isArray(rows) || !SYNC_TABLES.includes(table)) continue;
      for (const row of rows) {
        try {
          const sanitized = sanitizeRow(table, row);
          if (!sanitized || !sanitized.id) continue;
          // E6 + P2-C5: tenant isolation — rejeitar se salao_id existe e não
          // é o local. localSalaoId é resolvido dinamicamente do JWT/DB.
          const localSalaoId = this.getLocalSalaoId();
          if (sanitized.salao_id !== undefined && sanitized.salao_id !== null) {
            if (Number(sanitized.salao_id) !== Number(localSalaoId)) {
              console.warn(
                `[SyncService] DROP ${table}#${sanitized.id} — salao_id=${sanitized.salao_id} != local=${localSalaoId}`
              );
              continue;
            }
          } else {
            // Forçar salao_id local se ausente
            sanitized.salao_id = localSalaoId;
          }
          await this.upsertRow(table, sanitized);
          total++;
        } catch (e) {
          console.error(`[SyncService] Erro ao aplicar ${table}#${row?.id}:`, e.message);
        }
      }
    }
    return total;
  }

  // P2-B2: upsert atomic. Tenta INSERT ... ON CONFLICT(id) DO UPDATE,
  // suportado tanto por SQLite quanto Postgres. Em fallback, SELECT + UPDATE/INSERT.
  async upsertRow(table, row) {
    const cols = Object.keys(row);
    if (cols.length === 0) return;
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((c) => row[c]);
    const updates = cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    try {
      if (updates) {
        await queryRun(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT(id) DO UPDATE SET ${updates}`,
          values
        );
      } else {
        await queryRun(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    } catch (e) {
      // Fallback (caso o adapter não suporte ON CONFLICT) — comportamento legado
      const existing = await queryOne(`SELECT id FROM ${table} WHERE id = ?`, [row.id]);
      if (existing) {
        const sets = cols.filter((c) => c !== 'id').map((c) => `${c} = ?`);
        const updValues = cols.filter((c) => c !== 'id').map((c) => row[c]);
        updValues.push(row.id);
        await queryRun(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, updValues);
      } else {
        await queryRun(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
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
module.exports.isValidCloudUrl = isValidCloudUrl;
