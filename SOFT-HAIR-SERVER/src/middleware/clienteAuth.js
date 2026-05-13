const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

// [P6-A5] Cache de status app_ativo (2 min TTL) — evita query DB por request
const _clienteCache = new Map(); // clienteId -> { ok, exp }
const CLIENTE_CACHE_TTL_MS = 2 * 60 * 1000;

async function _clienteAppAtivo(clienteId) {
  const now = Date.now();
  const cached = _clienteCache.get(clienteId);
  if (cached && cached.exp > now) return cached.ok;
  try {
    const { queryOne } = require('../config/database');
    const row = await queryOne(
      'SELECT COALESCE(app_ativo, false) AS app_ativo, COALESCE(ativo, true) AS ativo FROM clientes WHERE id = $1',
      [clienteId]
    );
    const ok = !!(row && row.ativo && row.app_ativo);
    _clienteCache.set(clienteId, { ok, exp: now + CLIENTE_CACHE_TTL_MS });
    return ok;
  } catch {
    // Em caso de falha de DB, não bloqueia — JWT continua válido.
    return null;
  }
}

function invalidateClienteCache(clienteId) {
  if (clienteId == null) _clienteCache.clear();
  else _clienteCache.delete(clienteId);
}

const clienteAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ success: false, error: 'Autenticação necessária' });

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token)
    return res.status(401).json({ success: false, error: 'Token inválido' });

  try {
    // [P4-M1] Travar algorithm em HS256 — defense-in-depth para evitar confusão
    // de algoritmo caso JWT_SECRET seja trocado por PEM acidentalmente.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'cliente')
      return res.status(403).json({ success: false, error: 'Acesso não autorizado' });
    // [P2-A5] Checar blacklist também para cliente — logout deve revogar.
    if (await AuthService.isTokenRevoked(decoded)) {
      return res.status(401).json({ success: false, error: 'Token revogado' });
    }
    // [P6-A5] Bloquear se cliente foi anonimizado/desativado (LGPD delete-me)
    const clienteId = decoded.clienteId || decoded.clienteAppId;
    if (clienteId) {
      const ativo = await _clienteAppAtivo(clienteId);
      if (ativo === false) {
        return res.status(401).json({ success: false, error: 'Conta desativada' });
      }
    }
    req.clienteId = clienteId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expirado ou inválido' });
  }
};

module.exports = { clienteAuthMiddleware, invalidateClienteCache };
