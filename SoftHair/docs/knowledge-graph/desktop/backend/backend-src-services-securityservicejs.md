# backend/src/services/securityService.js

**Repository:** Desktop
**File:** `backend/src/services/securityService.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/services/securityService.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
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
const { pool } = require('../config/database');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/encryption');

class SecurityService {
  static async logSecurityEvent({
    type,
    userId = null,
    deviceId = null,
    ip = null,
    userAgent = null,
    endpoint = null,
    method = null,
    statusCode = null,
    message = null,
    additionalData = null,
  }) {
    try {
      await pool.query(
        `INSERT INTO logs_seguranca (tipo, usuario_id, dispositivo_id, ip, user_agent,
          endpoint, metodo, status_code, mensagem, dados_adicionais)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [type, userId, deviceId, ip, userAgent, endpoint, method, statusCode, message, additionalData]
      );
    } catch (error) {
      console.error('Erro ao registrar log de segurança:', error);
    }
  }

  static async logLoginAttempt({ email, ip, userAgent, success, message }) {
    try {
      await pool.query(
        `INSERT INTO tentativas_login (email, ip, user_agent, sucesso, mensagem)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, ip, userAgent, success, message]
      );
    } catch (error) {
      console.error('Erro ao registrar tentativa de login:', error);
    }
  }

  static async checkBruteForce(ip) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM tentativas_login
         WHERE ip = $1 AND sucesso = false AND criado_em > NOW() - INTERVAL '15 minutes'`,
        [ip]
      );
      return result.rows[0].count >= 5;
    } catch (error) {
      console.error('Erro ao verificar brute force:', error);
      return false;
    }
  }

  static async blockUser(userId) {
    try {
      await pool.query(
        'UPDATE usuarios SET bloqueado = true WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Erro ao bloquear usuário:', error);
    }
  }

  static async incrementFailedAttempts(userId) {
    try {
      await pool.query(
        `UPDATE usuarios SET tentativas_falhas = tentativas_falhas + 1,
         ultima_tentativa_falha = NOW() WHERE id = $1`,
        [userId]
      );

      const result = await pool.query(
        'SELECT tentativas_falhas FROM usuarios WHERE id = $1',
        [userId]
      );

      if (result.rows[0].tentativas_falhas >= 5) {
        await this.blockUser(userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao incrementar tentativas falhas:', error);
      return false;
    }
  }

  static async resetFailedAttempts(userId) {
    try {
      await pool.query(
        'UPDATE usuarios SET tentativas_falhas = 0, ultima_tentativa_falha = NULL WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Erro ao resetar tentativas falhas:', error);
    }
  }

  static async revokeToken(token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const exp = new Date(decoded.exp * 1000);

      await pool.query(
        'INSERT INTO tokens_revogados (token_hash, expira_em) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [tokenHash, exp]
      );
    } catch (error) {
      console.error('Erro ao revogar token:', error);
    }
  }

  static async isTokenRevoked(token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = await pool.query(
        'SELECT 1 FROM tokens_revogados WHERE token_hash = $1',
        [tokenHash]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erro ao verificar token revogado:', error);
      return false;
    }
  }

  static async registerDevice(userId, deviceInfo) {
    try {
      const deviceId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO dispositivos (id, usuario_id, info, ativo, criado_em)
         VALUES ($1, $2, $3, true, NOW())`,
        [deviceId, userId, JSON.stringify(deviceInfo)]
      );
      return deviceId;
    } catch (error) {
      console.error('Erro ao registrar dispositivo:', error);
      return null;
    }
  }

  static async validateDevice(deviceId, userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM dispositivos WHERE id = $1 AND usuario_id = $2 AND ativo = true',
        [deviceId, userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erro ao validar dispositivo:', error);
      return false;
    }
  }

  static async revokeDevice(deviceId) {
    try {
      await pool.query(
        'UPDATE dispositivos SET ativo = false WHERE id = $1',
        [deviceId]
      );
    } catch (error) {
      console.error('Erro ao revogar dispositivo:', error);
    }
  }

  static async encryptSensitiveData(data) {
    return {
      ...data,
      cpf_encrypted: data.cpf ? encrypt(data.cpf) : null,
      telefone_encrypted: data.telefone ? encrypt(data.telefone) : null,
      email_hash: data.email ? crypto.createHash('sha256').update(data.email).digest('hex') : null,
    };
  }

  static async decryptSensitiveData(data) {
    return {
      ...data,
      cpf: data.cpf_encrypted ? decrypt(data.cpf_encrypted) : null,
      telefone: data.telefone_encrypted ? decrypt(data.telefone_encrypted) : null,
    };
  }

  static sanitizeForLog(data) {
    const sensitiveFields = ['password', 'senha', 'token', 'cpf', 'telefone', 'email'];
    const sanitized = { ...data };
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    return sanitized;
  }
}

module.exports = SecurityService;
```
