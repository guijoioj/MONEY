# backend/src/routes/app/security.js

**Repository:** Desktop
**File:** `backend/src/routes/app/security.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/app/security.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const express = require('express');
const SecurityService = require('../../services/securityService');
const { pool } = require('../../config/database');
const crypto = require('crypto');
const router = express.Router();

// Endpoint para registro de dispositivo
router.post('/register-device', async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'API Key inválida'
      });
    }

    if (!deviceInfo || !deviceInfo.fingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Informações do dispositivo inválidas'
      });
    }

    // Registrar dispositivo (sem usuário ainda - será associado no login)
    const deviceId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO dispositivos (id, info, ativo, criado_em)
       VALUES ($1, $2, true, NOW())`,
      [deviceId, JSON.stringify(deviceInfo)]
    );

    await SecurityService.logSecurityEvent({
      type: 'DEVICE_REGISTERED',
      deviceId: deviceId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      endpoint: req.path,
      method: req.method,
      statusCode: 200,
      message: 'Dispositivo registrado com sucesso',
      additionalData: deviceInfo
    });

    res.json({
      success: true,
      data: { deviceId }
    });
  } catch (error) {
    console.error('Erro ao registrar dispositivo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar dispositivo'
    });
  }
});

// Endpoint para validar segurança do dispositivo
router.post('/validate', async (req, res) => {
  try {
    const { deviceFingerprint } = req.body;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'API Key inválida'
      });
    }

    if (!deviceFingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint do dispositivo não fornecido'
      });
    }

    // Verificar se dispositivo está registrado e ativo
    const result = await pool.query(
      'SELECT id, ativo FROM dispositivos WHERE info->\'fingerprint\' = $1',
      [deviceFingerprint]
    );

    if (result.rows.length === 0) {
      // Dispositivo não registrado - aceitar em desenvolvimento
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          success: true,
          data: { valid: true, message: 'Dispositivo aceito (desenvolvimento)' }
        });
      }

      return res.status(404).json({
        success: false,
        error: 'Dispositivo não registrado'
      });
    }

    const device = result.rows[0];

    if (!device.ativo) {
      return res.status(403).json({
        success: false,
        error: 'Dispositivo bloqueado'
      });
    }

    // Atualizar último acesso
    await pool.query(
      'UPDATE dispositivos SET ultimo_acesso = NOW() WHERE id = $1',
      [device.id]
    );

    res.json({
      success: true,
      data: { valid: true, deviceId: device.id }
    });
  } catch (error) {
    console.error('Erro ao validar dispositivo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar dispositivo'
    });
  }
});

// Endpoint para obter configurações de segurança
router.get('/config', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'API Key inválida'
      });
    }

    const config = {
      forceHttps: process.env.FORCE_HTTPS === 'true',
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5
      },
      securityFeatures: {
        encryption: true,
        deviceValidation: true,
        tokenRevocation: true,
        bruteForceProtection: true,
        ssl: process.env.FORCE_HTTPS === 'true'
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Erro ao obter configurações de segurança:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter configurações'
    });
  }
});

// Endpoint para revogar dispositivo
router.delete('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      });
    }

    // Decodificar token para obter userId
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar se dispositivo pertence ao usuário
    const result = await pool.query(
      'SELECT id FROM dispositivos WHERE id = $1 AND usuario_id = $2',
      [deviceId, decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dispositivo não encontrado'
      });
    }

    // Revogar dispositivo
    await pool.query(
      'UPDATE dispositivos SET ativo = false WHERE id = $1',
      [deviceId]
    );

    await SecurityService.logSecurityEvent({
      type: 'DEVICE_REVOKED',
      userId: decoded.userId,
      deviceId: deviceId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      endpoint: req.path,
      method: req.method,
      statusCode: 200,
      message: 'Dispositivo revogado com sucesso'
    });

    res.json({
      success: true,
      message: 'Dispositivo revogado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao revogar dispositivo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao revogar dispositivo'
    });
  }
});

module.exports = router;
```
