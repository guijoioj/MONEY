// [P5-C2] Audit log persistente — registra ações sensíveis em DB queryable.
// Não-bloqueante: falhas de log não impedem a operação principal (apenas console.error).
const { pool } = require('../config/database');

// [P6-A4] Sanitização: remove campos sensíveis antes de gravar em before_data/after_data.
// Audit log é queryable por admin via psql — não pode conter senha_hash, tokens, etc.
const SENSITIVE_KEYS = new Set([
  'senha_hash', 'senha', 'password', 'passwordhash', 'password_hash',
  'token', 'jwt', 'jti', 'api_key', 'api_key_hash', 'apikey',
  'push_token', 'pushtoken', 'refresh_token', 'access_token',
  'secret', 'private_key', 'auth_token'
]);

function redactSensitive(obj, depth = 0) {
  if (obj == null || typeof obj !== 'object' || depth > 6) return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactSensitive(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redactSensitive(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Registra uma ação sensível no audit_log.
 * @param {Object} opts
 * @param {Object} [opts.req] - Express request (extrai ip, ua, user, salaoId).
 * @param {string} opts.action - Ação canônica (ex.: 'comissao.pagar', 'fechamento.delete').
 * @param {string} [opts.entityType] - Tipo da entidade (ex.: 'comissao').
 * @param {number} [opts.entityId] - ID da entidade.
 * @param {Object|null} [opts.before] - Snapshot anterior (JSON).
 * @param {Object|null} [opts.after] - Snapshot posterior (JSON).
 * @param {string} [opts.actorType] - Sobrescreve detecção automática ('admin'|'cliente'|'profissional'|'system').
 * @param {number} [opts.actorId] - Sobrescreve detecção automática.
 * @param {number} [opts.salaoId] - Sobrescreve req.salaoId.
 */
async function logAction({ req, action, entityType = null, entityId = null, before = null, after = null, actorType, actorId, salaoId } = {}) {
  try {
    if (!action || typeof action !== 'string') return;

    let _actorId = actorId;
    let _actorType = actorType;
    let _salaoId = salaoId;
    let ip = null;
    let ua = null;

    if (req) {
      ip = (req.ip || req.connection?.remoteAddress || null);
      ua = (req.headers?.['user-agent'] || null);
      if (_salaoId == null) _salaoId = req.salaoId || req.salonId || null;
      if (_actorId == null) {
        _actorId = req.user?.userId || req.user?.id || req.profissionalId || req.clienteId || null;
      }
      if (!_actorType) {
        if (req.user?.tipo === 'admin') _actorType = 'admin';
        else if (req.profissionalId) _actorType = 'profissional';
        else if (req.clienteId) _actorType = 'cliente';
        else if (req.user?.type) _actorType = String(req.user.type).slice(0, 20);
        else if (req.apiKey) _actorType = 'apikey';
        else _actorType = 'unknown';
      }
    }

    await pool.query(
      `INSERT INTO audit_log
        (salao_id, actor_id, actor_type, action, entity_type, entity_id, before_data, after_data, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        _salaoId || null,
        _actorId || null,
        _actorType ? String(_actorType).slice(0, 20) : null,
        String(action).slice(0, 100),
        entityType ? String(entityType).slice(0, 50) : null,
        entityId || null,
        // [P6-A4] Sanitizar antes de persistir
        before ? JSON.stringify(redactSensitive(before)) : null,
        after ? JSON.stringify(redactSensitive(after)) : null,
        ip ? String(ip).slice(0, 45) : null,
        ua ? String(ua).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    // Falha em audit log NUNCA derruba a operação. Loga e segue.
    console.error('[AUDIT_LOG] falha ao persistir:', err.message);
  }
}

module.exports = { logAction };
