const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

const clienteAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ success: false, error: 'Autenticação necessária' });

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token)
    return res.status(401).json({ success: false, error: 'Token inválido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'cliente')
      return res.status(403).json({ success: false, error: 'Acesso não autorizado' });
    // [P2-A5] Checar blacklist também para cliente — logout deve revogar.
    if (await AuthService.isTokenRevoked(decoded)) {
      return res.status(401).json({ success: false, error: 'Token revogado' });
    }
    req.clienteId = decoded.clienteId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expirado ou inválido' });
  }
};

module.exports = { clienteAuthMiddleware };
