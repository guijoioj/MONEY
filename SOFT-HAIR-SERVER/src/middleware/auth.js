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
        // [A3] Bloquear tokens revogados via jwt_blacklist
        if (await AuthService.isTokenRevoked(decoded)) {
          return res.status(401).json({ success: false, error: 'Token revogado' });
        }
        req.user = decoded;
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

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
    });
  }
  next();
};

module.exports = { authMiddleware, optionalAuth, requireAdmin };
