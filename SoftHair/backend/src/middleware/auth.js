/**
 * Middleware de autenticação JWT para backend embarcado.
 * Versão simplificada: só JWT (não há devices/api keys no app desktop).
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'softhair-local-dev-secret-change-me';

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Autenticação necessária' });
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, error: 'Formato de token inválido' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.salaoId = decoded.salaoId;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tipo: user.tipo,
      salaoId: user.salao_id,
      nome: user.nome,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
