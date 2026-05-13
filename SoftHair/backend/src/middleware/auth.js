/**
 * Middleware de autenticação JWT para backend embarcado.
 * Versão simplificada: só JWT (não há devices/api keys no app desktop).
 *
 * Pass 1 (E1): JWT_SECRET nunca tem fallback hardcoded.
 * Pass 2 (P2-C1/P2-C2/P2-B1/P2-B5):
 *   - geração centralizada em `lib/secrets.js`
 *   - write atomic via tmp+rename
 *   - 32 bytes (em vez de 48) — suficiente para HS256/HS512
 *   - aborta em produção se não conseguir persistir o secret
 */

const jwt = require('jsonwebtoken');
const path = require('path');
const { resolveJwtSecret } = require('../lib/secrets');

function resolveDataDir() {
  return (
    process.env.SOFTHAIR_DATA_DIR ||
    path.join(__dirname, '..', '..', 'database')
  );
}

function loadOrGenerateSecret() {
  const dataDir = resolveDataDir();
  try {
    const requirePersisted = process.env.NODE_ENV === 'production';
    return resolveJwtSecret({ dataDir, requirePersisted });
  } catch (e) {
    // requirePersisted=true em prod já lançou — falha duro.
    console.error('[auth] Falha fatal ao resolver JWT secret:', e.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // Em dev/CI, último recurso: usar o resolveJwtSecret sem dataDir
    // (gera efêmero).
    return resolveJwtSecret({ requirePersisted: false });
  }
}

const JWT_SECRET = loadOrGenerateSecret();

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
    // E8: reduzido de 30d para 24h
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
