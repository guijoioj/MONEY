const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [bearer, token] = authHeader.split(' ');
  return bearer === 'Bearer' ? token : null;
}

async function appAuthMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Autenticacao necessaria' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // [M7] Exige explicitamente type === 'cliente'. JWT antigos (sem type) ou de outro tipo são rejeitados.
    // Não aceita mais decoded.userId como fallback (vetor de escalada admin→cliente).
    if (decoded.type !== 'cliente') {
      return res.status(403).json({ success: false, error: 'Acesso nao autorizado' });
    }
    const clienteId = decoded.clienteAppId || decoded.clienteId;
    if (!clienteId) {
      return res.status(403).json({ success: false, error: 'Acesso nao autorizado' });
    }

    // [P2-A5] Checar blacklist — logout do cliente deve revogar o token.
    if (await AuthService.isTokenRevoked(decoded)) {
      return res.status(401).json({ success: false, error: 'Token revogado' });
    }

    req.clienteApp = {
      clienteAppId: clienteId,
      clienteId,
      email: decoded.email,
      nome: decoded.nome
    };
    req.salaoId = decoded.salaoId;
    req.salonId = decoded.salaoId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expirado ou invalido' });
  }
}

async function profissionalAppMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Autenticacao necessaria' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // [M7] Exige explicitamente type === 'profissional'. Sem fallback para userId.
    if (decoded.type !== 'profissional') {
      return res.status(403).json({ success: false, error: 'Acesso nao autorizado' });
    }
    const profissionalId = decoded.profissionalId;
    if (!profissionalId) {
      return res.status(403).json({ success: false, error: 'Acesso nao autorizado' });
    }

    // [P2-A5] Checar blacklist — logout do profissional deve revogar o token.
    if (await AuthService.isTokenRevoked(decoded)) {
      return res.status(401).json({ success: false, error: 'Token revogado' });
    }

    req.profissionalId = profissionalId;
    req.salaoId = decoded.salaoId;
    req.salonId = decoded.salaoId;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expirado ou invalido' });
  }
}

module.exports = { appAuthMiddleware, profissionalAppMiddleware };
