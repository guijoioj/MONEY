const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

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
    req.profissionalId = decoded.profissionalId;
    req.salaoId = decoded.salaoId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expirado ou inválido' });
  }
};

module.exports = { profissionalAuthMiddleware };
