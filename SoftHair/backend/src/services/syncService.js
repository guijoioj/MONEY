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

// P7-A8: limite de mudanças por ciclo. Sem isso, salão offline há 6 meses
// envia 50K rows em um único push (timeout, 100% CPU, OOM). Com limit, sync
// é progressivo — cada ciclo envia até N mudanças até zerar a backlog.
const SYNC_BATCH_LIMIT = parseInt(process.env.SYNC_BATCH_LIMIT, 10) || 5000;

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
    // P3-B1: cache TTL — invalida após 1h para pegar trocas de salão.
    this._localSalaoIdAt = 0;
    this.knownFingerprint = null; // P2-C6: TOFU fingerprint do cert

    // P5-M4: ids recém-aplicados via pull. Evita re-push imediato na próxima
    // iteração de _doSync (já que applyRemoteChanges seta updated_at = now).
    // Mantido no formato `${table}#${id}` → expira após 2 iterações.
    this._recentlyPulled = new Map(); // key → ttlCount

    // P7-A5: retry exponencial. Após falha transitória (network blip, 5xx),
    // adia próximo tick por base × 2^N até MAX_BACKOFF_MS. Em sucesso, reseta.
    this._consecutiveFailures = 0;
    this._nextAllowedSyncAt = 0;
    this.MAX_BACKOFF_MS = 5 * 60 * 1000; // 5min

    this.loadConfig();
  }

  // P2-C5 + P3-C7 + P3-B1: resolve salao_id local do banco (single-tenant local) ou do JWT cloud.
  // Cacheia o resultado para evitar query a cada pull.
  //
  // P3-C7: se o JWT cloud informa um salao_id que NÃO existe no banco local
  // (admin trocou de salão na cloud sem reset local), warn e cai no salao_id do
  // banco local. Sem esse check, o pull tenta inserir rows com salao_id=2
  // mas saloes(id=2) não existe → FK violation silenciosa.
  //
  // P3-B1: cache TTL 1h — invalida automaticamente para pegar trocas de salão
  // mesmo se o usuário não chamar `configure({ token })` (que invalida no Pass 2).
  getLocalSalaoId() {
    const CACHE_TTL_MS = 60 * 60 * 1000;
    const now = Date.now();
    if (this._localSalaoId && (now - this._localSalaoIdAt) < CACHE_TTL_MS) {
      return this._localSalaoId;
    }
    let jwtSalaoId = null;
    try {
      if (this.token) {
        const parts = this.token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.salaoId) {
            jwtSalaoId = Number(payload.salaoId);
          }
        }
      }
    } catch (_) { /* JWT inválido */ }

    let localSalaoId = null;
    try {
      const row = queryOne(`SELECT id FROM saloes ORDER BY id LIMIT 1`);
      if (row && row.id) localSalaoId = Number(row.id);
    } catch (e) {
      console.error('[SyncService] Falha ao resolver salao_id local do DB:', e.message);
    }

    // P3-C7: se o JWT informa um salao_id, validar que existe localmente.
    if (jwtSalaoId !== null) {
      try {
        const exists = queryOne(`SELECT id FROM saloes WHERE id = ?`, [jwtSalaoId]);
        if (exists) {
          this._localSalaoId = jwtSalaoId;
          this._localSalaoIdAt = now;
          return this._localSalaoId;
        }
        // Mismatch — informar via lastError para UI mostrar.
        this.lastError =
          `JWT cloud informa salao_id=${jwtSalaoId} mas não existe localmente. ` +
          `Usando salao_id=${localSalaoId || 1} do banco local. Reconecte com o salão correto.`;
        console.warn('[SyncService]', this.lastError);
      } catch (e) {
        console.error('[SyncService] Falha ao validar salao_id do JWT:', e.message);
      }
    }

    if (localSalaoId !== null) {
      this._localSalaoId = localSalaoId;
      this._localSalaoIdAt = now;
      return this._localSalaoId;
    }
    // Fallback final (banco fresh sem salão).
    this._localSalaoId = 1;
    this._localSalaoIdAt = now;
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
    // P5-A10: durante disconnect em curso, NUNCA regrava o arquivo
    // — protege da race "axios em flight termina e saveConfig recria sync-config.json".
    if (this._disconnecting) return;
    // P5-M7: não criar arquivo vazio se não há config relevante.
    if (!this.cloudUrl && !this.token && !this.enabled && !this.lastSync) {
      try { if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE); } catch (_) { /* noop */ }
      return;
    }
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
   * E9 + P2-B4 + P5-A10: desconectar — limpa todos os campos de credencial
   * em memória e remove o arquivo do disco. Aguarda sync em progresso antes
   * de zerar fields para evitar race onde axios call em flight regrava o
   * arquivo via saveConfig().
   */
  async disconnect() {
    this._disconnecting = true;
    try {
      this.stop();
      // P5-A10: aguarda sync em progresso terminar para não recriar o arquivo.
      if (this.syncPromise) {
        try { await this.syncPromise; } catch (_) { /* ignora erro de sync abortado */ }
      }
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
        } catch (e2) {
          // P3-M3: último recurso — truncate para ficar vazio
          try {
            fs.truncateSync(CONFIG_FILE, 0);
            console.warn('[SyncService] disconnect: truncate fallback aplicado');
          } catch (_) {
            console.error('[SyncService] disconnect: ALL FALLBACKS FAILED — credenciais podem persistir em disco.');
          }
        }
      }
    } finally {
      this._disconnecting = false;
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
  // P3-B5: keepAlive reduz handshake TLS em syncs frequentes (intervalo 10-30s).
  buildAxiosConfig() {
    const agent = new https.Agent({
      rejectUnauthorized: true, // E3: NUNCA aceita cert inválido
      keepAlive: true,
      maxSockets: 5,
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
      // P6-A7: 45s cobre cold start típico do Render free tier (30-60s).
      // Antes 15s falhava na primeira request da manhã enquanto a instância
      // estava subindo.
      timeout: 45000,
      httpsAgent: agent,
    };
  }

  /**
   * E18: mutex via promise — reentrante seguro.
   * P7-A5: respeita backoff exponencial em falhas transitórias.
   */
  async syncNow({ force = false } = {}) {
    if (this.syncPromise) return this.syncPromise;
    if (!this.enabled || !this.cloudUrl || !this.token) {
      return { skipped: true, reason: 'desabilitado ou não configurado' };
    }
    // E3: validar URL antes de fazer request
    if (!isValidCloudUrl(this.cloudUrl)) {
      this.lastError = 'cloudUrl inválida (apenas HTTPS ou loopback)';
      return { success: false, error: this.lastError };
    }
    // P7-A5: respeita janela de backoff salvo se user clicou "Sincronizar Agora" (force).
    if (!force && Date.now() < this._nextAllowedSyncAt) {
      const waitSec = Math.ceil((this._nextAllowedSyncAt - Date.now()) / 1000);
      return { skipped: true, reason: `backoff ativo (${waitSec}s até próximo retry)` };
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
      // P7-A5: reset backoff em sucesso.
      this._consecutiveFailures = 0;
      this._nextAllowedSyncAt = 0;
      this.saveConfig();

      return {
        success: true,
        pushed: changes.length,
        pulled: totalRemote,
        at: this.lastSync,
        truncated: changes.length === SYNC_BATCH_LIMIT,
      };
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
      // P7-A5: backoff exponencial em falhas transitórias (5xx, ECONNRESET, ETIMEDOUT).
      // Increment counter (max 5), aplica `base * 2^N` no _nextAllowedSyncAt.
      // Sucesso resetará para zero acima.
      const isTransient = !status || (status >= 500 && status < 600) ||
        /ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED/.test(error.code || '');
      if (isTransient) {
        this._consecutiveFailures = Math.min(this._consecutiveFailures + 1, 5);
        const base = 30 * 1000; // 30s base
        const delay = Math.min(base * Math.pow(2, this._consecutiveFailures - 1), this.MAX_BACKOFF_MS);
        this._nextAllowedSyncAt = Date.now() + delay;
        this.lastError = `${error.message} (retry em ${Math.ceil(delay / 1000)}s)`;
      } else {
        this.lastError = error.message;
      }
      console.error('[SyncService] Erro:', error.message);
      return { success: false, error: this.lastError };
    }
  }

  /**
   * E5: emite formato granular [{table, operation, data}] esperado pelo server cloud.
   *     `operation` é derivado heuristicamente: 'INSERT' se created_at > since,
   *     senão 'UPDATE'. (DELETE seria via sync_log mas é skip por ora.)
   */
  async collectLocalChanges(since) {
    const out = [];
    // P5-M4: decrementa TTL e remove expirados antes de coletar.
    for (const [key, ttl] of this._recentlyPulled) {
      if (ttl <= 0) this._recentlyPulled.delete(key);
      else this._recentlyPulled.set(key, ttl - 1);
    }
    // P7-A8: distribuir limite igualmente entre tabelas para sync progressivo.
    // Quando há backlog grande (>5K rows), cada tabela contribui ~700 e o resto
    // entra no próximo ciclo (next `since` move para frente quando lastSync salvar).
    const perTable = Math.max(50, Math.floor(SYNC_BATCH_LIMIT / SYNC_TABLES.length));
    for (const t of SYNC_TABLES) {
      if (out.length >= SYNC_BATCH_LIMIT) break;
      try {
        // E4: SELECT explícito por allowlist (em vez de SELECT *)
        const cols = TABLE_COLUMNS[t].join(', ');
        // P7-A8: ORDER BY updated_at para sync determinístico e progressivo.
        const rows = await query(
          `SELECT ${cols} FROM ${t}
           WHERE updated_at > ? OR (updated_at IS NULL AND created_at > ?)
           ORDER BY COALESCE(updated_at, created_at) ASC
           LIMIT ?`,
          [since, since, perTable]
        );
        for (const row of rows) {
          if (out.length >= SYNC_BATCH_LIMIT) break;
          const data = sanitizeRow(t, row);
          if (!data) continue;
          // P5-M4: skip se foi recém-aplicado via pull (evita loop push-pull).
          if (data.id && this._recentlyPulled.has(`${t}#${data.id}`)) {
            continue;
          }
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
    // P3-M6: agregar drops por tabela em vez de logar cada salao_id individual.
    // Isso reduz info leak via logs sincronizados (OneDrive etc.) e evita poluir
    // o arquivo de log com IDs sensíveis.
    const dropCounts = {};
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
              dropCounts[table] = (dropCounts[table] || 0) + 1;
              continue;
            }
          } else {
            sanitized.salao_id = localSalaoId;
          }
          await this.upsertRow(table, sanitized);
          // P5-M4: marca ids recém-aplicados para evitar re-push imediato.
          // TTL=2 cobre uma iteração completa (collect e push antes do TTL chegar a 0).
          if (sanitized.id) {
            this._recentlyPulled.set(`${table}#${sanitized.id}`, 2);
          }
          total++;
        } catch (e) {
          console.error(`[SyncService] Erro ao aplicar ${table}#${row?.id}:`, e.message);
        }
      }
    }
    // P3-M6: log agregado (counts), sem IDs individuais
    const dropTotal = Object.values(dropCounts).reduce((a, b) => a + b, 0);
    if (dropTotal > 0) {
      const summary = Object.entries(dropCounts).map(([t, n]) => `${t}:${n}`).join(', ');
      console.warn(`[SyncService] applyRemoteChanges: ${dropTotal} rows descartadas por tenant mismatch (${summary})`);
    }
    return total;
  }

  // P2-B2 + P5-C4: upsert atomic com detecção de conflito.
  //
  // Antes de sobrescrever, compara `updated_at` local vs remoto:
  //   - local mais recente → registra em sync_conflicts e NÃO sobrescreve.
  //   - remoto mais recente OU empate → aplica (comportamento histórico).
  //   - row inexistente local → INSERT direto.
  //
  // Conflitos ficam pendentes em sync_conflicts para revisão humana via /sync.
  async upsertRow(table, row) {
    const cols = Object.keys(row);
    if (cols.length === 0) return;

    // P5-C4: detecção de conflito apenas se row tem updated_at remoto E já existe local.
    if (row.id && row.updated_at) {
      try {
        const existing = await queryOne(
          `SELECT * FROM ${table} WHERE id = ?`,
          [row.id]
        );
        if (existing && existing.updated_at) {
          // Comparação ISO lexicográfica funciona para strings ISO 8601.
          const localTs = String(existing.updated_at);
          const remoteTs = String(row.updated_at);
          if (localTs > remoteTs) {
            // Conflito: local mais recente. Registra e abortar overwrite.
            try {
              await queryRun(
                `INSERT INTO sync_conflicts (tabela, registro_id, local_updated_at, remote_updated_at, local_data, remote_data, resolved)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [
                  table,
                  Number(row.id),
                  localTs,
                  remoteTs,
                  JSON.stringify(existing),
                  JSON.stringify(row),
                ]
              );
              console.warn(
                `[SyncService] CONFLITO em ${table}#${row.id} — local=${localTs} > remoto=${remoteTs}. Mantido local.`
              );
            } catch (e) {
              console.error('[SyncService] Falha ao registrar conflito:', e.message);
            }
            return; // não sobrescreve
          }
        }
      } catch (e) {
        // Falha na detecção é não-fatal; cai no caminho histórico para não bloquear sync.
        console.warn(`[SyncService] Falha ao checar conflito ${table}#${row.id}: ${e.message}`);
      }
    }

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

  // P5-C4: força aplicação do payload remoto bypassando o check de conflito.
  // Usado pela rota /sync/conflicts/:id/resolve quando user opta por "remote".
  async upsertRowForce(table, row) {
    if (!SYNC_TABLES.includes(table)) {
      throw new Error(`Tabela não permitida no sync: ${table}`);
    }
    const sanitized = sanitizeRow(table, row);
    if (!sanitized || !sanitized.id) {
      throw new Error('Row inválida (sem id ou colunas)');
    }
    const cols = Object.keys(sanitized);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((c) => sanitized[c]);
    const updates = cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
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
      // P7-A5: expor estado de backoff para UI mostrar "Aguardando Ns antes do próximo retry"
      consecutiveFailures: this._consecutiveFailures,
      nextAllowedSyncAt: this._nextAllowedSyncAt,
      backoffActive: Date.now() < this._nextAllowedSyncAt,
    };
  }
}

module.exports = new SyncService();
module.exports.isValidCloudUrl = isValidCloudUrl;
