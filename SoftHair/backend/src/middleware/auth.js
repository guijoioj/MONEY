/**
 * Middleware de autenticação JWT para backend embarcado.
 * Versão simplificada: só JWT (não há devices/api keys no app desktop).
 *
 * Segurança (E1): JWT_SECRET nunca tem fallback hardcoded. Se a env não for
 * fornecida, o secret é gerado aleatoriamente no primeiro boot, persistido em
 * arquivo `secrets.json` no diretório userData (chmod 0o600), e reutilizado
 * em boots seguintes. Em ambiente NODE_ENV=production sem env nem arquivo
 * gravável, abortamos a inicialização.
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function resolveDataDir() {
  return (
    process.env.SOFTHAIR_DATA_DIR ||
    path.join(__dirname, '..', '..', 'database')
  );
}

function loadOrGenerateSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }

  const dataDir = resolveDataDir();
  const secretsFile = path.join(dataDir, 'secrets.json');

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(secretsFile)) {
      const cfg = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
      if (cfg.jwtSecret && cfg.jwtSecret.length >= 32) {
        return cfg.jwtSecret;
      }
    }

    // Primeiro boot — gerar e persistir
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(
      secretsFile,
      JSON.stringify({ jwtSecret: generated, createdAt: new Date().toISOString() }, null, 2),
      { mode: 0o600 }
    );
    try {
      fs.chmodSync(secretsFile, 0o600);
    } catch (_) {
      /* Windows pode ignorar chmod */
    }
    console.log('[auth] JWT_SECRET gerado e persistido em', secretsFile);
    return generated;
  } catch (e) {
    console.error('[auth] Falha ao carregar/gerar JWT secret:', e.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth] Abortando: secret não pôde ser persistido em produção.');
      process.exit(1);
    }
    // Em dev (CI, testes), fallback efêmero — TOKEN só vale para esta execução.
    return crypto.randomBytes(48).toString('hex');
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
