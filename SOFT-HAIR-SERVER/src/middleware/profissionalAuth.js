const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

// [P6-A5] Cache de status app_ativo (2 min TTL)
const _profCache = new Map();
const PROF_CACHE_TTL_MS = 2 * 60 * 1000;

async function _profAppAtivo(profId) {
  const now = Date.now();
  const cached = _profCache.get(profId);
  if (cached && cached.exp > now) return cached.ok;
  try {
    const { queryOne } = require('../config/database');
    const row = await queryOne(
      'SELECT COALESCE(app_ativo, false) AS app_ativo, COALESCE(ativo, true) AS ativo FROM profissionais WHERE id = $1',
      [profId]
    );
    const ok = !!(row && row.ativo && row.app_ativo);
    _profCache.set(profId, { ok, exp: now + PROF_CACHE_TTL_MS });
    return ok;
  } catch {
    return null;
  }
}

function invalidateProfissionalCache(profId) {
  if (profId == null) _profCache.clear();
  else _profCache.delete(profId);
}

const profissionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ success: false, error: 'Autenticação necessária' });

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token)
    return res.status(401).json({ success: false, error: 'Token inválido' });

  try {
    // [P4-M1] Travar algorithm em HS256.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'profissional')
      return res.status(403).json({ success: false, error: 'Acesso não autorizado' });
    // [P2-A5] Checar blacklist — logout deve revogar token de profissional.
    if (await AuthService.isTokenRevoked(decoded)) {
      return res.status(401).json({ success: false, error: 'Token revogado' });
    }
    // [P6-A5] Bloquear se profissional foi desativado
    if (decoded.profissionalId) {
      const ativo = await _profAppAtivo(decoded.profissionalId);
      if (ativo === false) {
        return res.status(401).json({ success: false, error: 'Conta desativada' });
      }
    }
    req.profissionalId = decoded.profissionalId;
    req.salaoId = decoded.salaoId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expirado ou inválido' });
  }
};

module.exports = { profissionalAuthMiddleware, invalidateProfissionalCache };
