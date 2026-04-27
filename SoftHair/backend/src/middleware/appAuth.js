const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

const appAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const deviceId = req.headers['x-device-id'];
    const appVersion = req.headers['x-app-version'];
    const apiKey = req.headers['x-api-key'];

    if (!authHeader) return res.status(401).json({ success: false, error: 'Token não fornecido' });
    if (!deviceId) return res.status(401).json({ success: false, error: 'Device ID não fornecido' });
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ success: false, error: 'API Key inválida' });
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) return res.status(401).json({ success: false, error: 'Token inválido' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.clienteAppId) return res.status(401).json({ success: false, error: 'Token de app inválido' });

    const deviceResult = await pool.query(
      'SELECT * FROM dispositivos WHERE id = $1 AND usuario_id = $2 AND ativo = true',
      [deviceId, decoded.userId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Dispositivo não autorizado' });
    }

    const device = deviceResult.rows[0];
    const now = Math.floor(Date.now() / 1000);

    if (device.ultimo_acesso) {
      const lastAccess = Math.floor(new Date(device.ultimo_acesso).getTime() / 1000);
      const inactivityPeriod = now - lastAccess;

      if (inactivityPeriod > 7200) {
        await pool.query('UPDATE dispositivos SET ativo = false WHERE id = $1', [deviceId]);
        return res.status(401).json({ success: false, error: 'Sessão expirada por inatividade' });
      }
    }

    await pool.query(
      'UPDATE dispositivos SET ultimo_acesso = NOW(), app_version = $1 WHERE id = $2',
      [appVersion, deviceId]
    );

    req.clienteApp = decoded;
    req.deviceId = deviceId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    return res.status(500).json({ success: false, error: 'Erro na autenticação' });
  }
};

const profissionalAppMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const deviceId = req.headers['x-device-id'];
    const apiKey = req.headers['x-api-key'];

    if (!authHeader) return res.status(401).json({ success: false, error: 'Token não fornecido' });
    if (!deviceId) return res.status(401).json({ success: false, error: 'Device ID não fornecido' });
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ success: false, error: 'API Key inválida' });
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) return res.status(401).json({ success: false, error: 'Token inválido' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.salonId) return res.status(401).json({ success: false, error: 'Token inválido' });

    const deviceResult = await pool.query(
      'SELECT * FROM dispositivos WHERE id = $1 AND usuario_id = $2 AND ativo = true',
      [deviceId, decoded.userId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Dispositivo não autorizado' });
    }

    req.user = decoded;
    req.salonId = decoded.salonId;
    req.profissionalId = decoded.profissionalId;
    req.deviceId = deviceId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    return res.status(500).json({ success: false, error: 'Erro na autenticação' });
  }
};

module.exports = { appAuthMiddleware, profissionalAppMiddleware };
