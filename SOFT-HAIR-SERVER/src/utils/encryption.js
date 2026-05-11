const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  // [P5-A6] Validar formato antes de tentar decrypt — NUNCA retornar plaintext
  // silenciosamente para payloads inválidos (efetivamente desativaria crypto).
  if (typeof text !== 'string') {
    throw new Error('decrypt: input deve ser string');
  }
  const parts = text.split(':');
  if (parts.length !== 3) {
    throw new Error('decrypt: payload inválido (formato esperado iv:tag:cipher)');
  }
  // Validar que iv e tag são hex válidos
  if (!/^[0-9a-fA-F]+$/.test(parts[0]) || !/^[0-9a-fA-F]+$/.test(parts[1])) {
    throw new Error('decrypt: payload inválido (iv/tag não-hex)');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  if (iv.length !== IV_LENGTH) {
    throw new Error('decrypt: payload inválido (iv length)');
  }
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function hashSensitive(text) {
  if (!text) return null;
  return crypto.createHmac('sha256', process.env.HMAC_SECRET).update(text).digest('hex');
}

function maskCpf(cpf) {
  if (!cpf) return null;
  return cpf.replace(/(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})/, '***.$2.$3-**');
}

function maskPhone(phone) {
  if (!phone) return null;
  return phone.replace(/(\(\d{2}\))\s?(\d{5})-?(\d{4})/, '$1 *****-$3');
}

module.exports = {
  encrypt,
  decrypt,
  hashSensitive,
  maskCpf,
  maskPhone,
};
