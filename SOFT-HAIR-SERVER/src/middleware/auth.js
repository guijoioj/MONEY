const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    const deviceFingerprint = req.headers['x-device-fingerprint'];

    // Tentar autenticação por JWT
    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');
      if (bearer === 'Bearer' && token) {
        const decoded = AuthService.verifyToken(token);
        // [P4-C1] Bloquear tokens de cliente/profissional em endpoints admin.
        // authMiddleware é gateway para rotas de admin (`/api/clientes`, `/api/vendas`, etc.).
        // Tokens emitidos pelo app móvel (`appAuth`/`appProfissionalAuth`) carregam
        // `decoded.type` ∈ {'cliente','profissional'} e DEVEM ser rejeitados aqui —
        // só funcionam nos middlewares específicos (`clienteAuthMiddleware`/`profissionalAuthMiddleware`).
        if (decoded.type === 'cliente' || decoded.type === 'profissional') {
          return res.status(403).json({
            success: false,
            error: 'Token de usuário móvel não autorizado neste endpoint'
          });
        }
        // [A3] Bloquear tokens revogados via jwt_blacklist
        if (await AuthService.isTokenRevoked(decoded)) {
          return res.status(401).json({ success: false, error: 'Token revogado' });
        }
        // Alias semântico: `role` ≡ `tipo`. Frontend e middleware/role.js usam `role`/`tipo`.
        req.user = { ...decoded, role: decoded.tipo };
        req.token = token;
        req.salaoId = decoded.salaoId;
        req.salonId = decoded.salaoId;
        return next();
      }
    }

    // Tentar autenticação por API Key
    if (apiKey) {
      const keyData = await AuthService.validateApiKey(apiKey);
      req.apiKey = keyData;
      req.salaoId = keyData.salao_id;
      req.salonId = keyData.salao_id;
      return next();
    }

    // Tentar autenticação por Device (para clientes mobile/desktop)
    if (deviceFingerprint) {
      const device = await AuthService.validateDevice(deviceFingerprint);
      req.device = device;
      req.salaoId = device.salao_id;
      req.salonId = device.salao_id;
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária'
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Token inválido'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    const deviceFingerprint = req.headers['x-device-fingerprint'];

    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');
      if (bearer === 'Bearer' && token) {
        const decoded = AuthService.verifyToken(token);
        // [P4-C1] Simetria com authMiddleware: optionalAuth também ignora tokens móveis
        // para não popular req.user de admin com dados de cliente/profissional.
        if (decoded.type === 'cliente' || decoded.type === 'profissional') {
          return next();
        }
        req.user = decoded;
        req.salaoId = decoded.salaoId;
        req.salonId = decoded.salaoId;
      }
    } else if (apiKey) {
      const keyData = await AuthService.validateApiKey(apiKey);
      req.apiKey = keyData;
      req.salaoId = keyData.salao_id;
      req.salonId = keyData.salao_id;
    } else if (deviceFingerprint) {
      const device = await AuthService.validateDevice(deviceFingerprint);
      req.device = device;
      req.salaoId = device.salao_id;
      req.salonId = device.salao_id;
    }

    next();
  } catch {
    next();
  }
};

// [P3-A3] Cache em memória de revalidação admin (2 min TTL).
// Reduz hit ao DB sem deixar token-stale válido por 24h se o admin for demoted/desativado.
// [P6-M2] cache passa a guardar token_version também
const _adminCache = new Map(); // userId -> { ok, tokenVersion, exp }
const ADMIN_CACHE_TTL_MS = 2 * 60 * 1000;

async function _adminFresh(userId) {
  const now = Date.now();
  const cached = _adminCache.get(userId);
  if (cached && cached.exp > now) return cached;
  try {
    const { queryOne } = require('../config/database');
    const row = await queryOne(
      'SELECT tipo, COALESCE(ativo, true) AS ativo, COALESCE(token_version, 0) AS token_version FROM usuarios WHERE id = $1',
      [userId]
    );
    const ok = !!(row && row.ativo && row.tipo === 'admin');
    const entry = { ok, tokenVersion: row?.token_version || 0, exp: now + ADMIN_CACHE_TTL_MS };
    _adminCache.set(userId, entry);
    return entry;
  } catch {
    // Em caso de falha DB, cai no JWT (não derruba sistema)
    return null;
  }
}

const requireAdmin = async (req, res, next) => {
  // Verifica o JWT primeiro (rápido)
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
    });
  }
  // [P3-A3] Revalida tipo/ativo no DB (cached). Bloqueia se foi demoted/desativado.
  // [P6-M2] Também valida tokenVersion — bloqueia se senha foi trocada após emissão do token.
  const userId = req.user.userId || req.user.id;
  if (userId) {
    const fresh = await _adminFresh(userId);
    if (fresh && fresh.ok === false) {
      return res.status(403).json({
        success: false,
        error: 'Acesso restrito a administradores'
      });
    }
    if (fresh && typeof fresh.tokenVersion === 'number' &&
        typeof req.user.tokenVersion === 'number' &&
        req.user.tokenVersion < fresh.tokenVersion) {
      return res.status(401).json({
        success: false,
        error: 'Token revogado (senha foi alterada)'
      });
    }
  }
  next();
};

// Permite invalidar cache externamente (ex.: ao atualizar tipo/ativo de um user).
function invalidateAdminCache(userId) {
  if (userId == null) {
    _adminCache.clear();
  } else {
    _adminCache.delete(userId);
  }
}

module.exports = { authMiddleware, optionalAuth, requireAdmin, invalidateAdminCache };
