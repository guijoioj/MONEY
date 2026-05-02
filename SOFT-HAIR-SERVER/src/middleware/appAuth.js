const jwt = require('jsonwebtoken');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [bearer, token] = authHeader.split(' ');
  return bearer === 'Bearer' ? token : null;
}

function appAuthMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Autenticacao necessaria' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const clienteId = decoded.clienteAppId || decoded.clienteId || decoded.userId;
    if (!clienteId || (decoded.type && decoded.type !== 'cliente')) {
      return res.status(403).json({ success: false, error: 'Acesso nao autorizado' });
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

function profissionalAppMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Autenticacao necessaria' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const profissionalId = decoded.profissionalId || decoded.userId;
    if (!profissionalId || (decoded.type && decoded.type !== 'profissional')) {
      return res.status(403).json({ success: false, error: 'Acesso nao autorizado' });
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
