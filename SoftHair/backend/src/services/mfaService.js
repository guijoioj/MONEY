const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun, withTransaction } = require('../config/database');
const emailService = require('./emailService');

class MFAService {
  static async generateMFASecret(userId) {
    const secret = crypto.randomBytes(20).toString('hex');
    const createdAt = new Date();
    
    await queryRun(
      `INSERT INTO mfa_secrets (user_id, secret, created_at, is_active)
       VALUES (?, ?, ?, true)
       ON CONFLICT (user_id) DO UPDATE SET secret = ?, created_at = ?, is_active = true`,
      [userId, secret, createdAt, secret, createdAt]
    );
    
    return secret;
  }

  static async enableMFA(userId, secret, code) {
    const { verify } = require('otplib');
    
    if (!verify(code, secret)) {
      throw new Error('Código MFA inválido');
    }
    
    await queryRun(
      'UPDATE mfa_secrets SET enabled = true, enabled_at = NOW() WHERE user_id = ?',
      [userId]
    );
    
    return { message: 'MFA habilitado com sucesso' };
  }

  static async disableMFA(userId, password) {
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    const bcrypt = require('bcryptjs');
    if (!bcrypt.compareSync(password, user.password)) {
      throw new Error('Senha incorreta');
    }
    
    await queryRun(
      'UPDATE mfa_secrets SET is_active = false WHERE user_id = ?',
      [userId]
    );
    
    return { message: 'MFA desabilitado com sucesso' };
  }

  static async verifyMFA(userId, code) {
    const { verify } = require('otplib');
    
    const secretRow = await queryOne(
      'SELECT secret FROM mfa_secrets WHERE user_id = ? AND enabled = true',
      [userId]
    );
    
    if (!secretRow) {
      return false;
    }
    
    return verify(code, secretRow.secret);
  }

  static async generateBackupCodes(userId, count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex'));
    }
    
    const hashedCodes = codes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );
    
    await withTransaction(async (client) => {
      await queryRun(
        `DELETE FROM mfa_backup_codes WHERE user_id = ?`,
        [userId]
      );
      
      const values = hashedCodes.map((hash, i) => 
        `(?, ?, NOW())`
      ).join(', ');
      
      const params = hashedCodes.flatMap(hash => [userId, hash]);
      
      await queryRun(
        `INSERT INTO mfa_backup_codes (user_id, code_hash, created_at) VALUES ${values}`,
        params
      );
    });
    
    return codes;
  }

  static async verifyBackupCode(userId, code) {
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    
    const codeRow = await queryOne(
      `SELECT id FROM mfa_backup_codes 
       WHERE user_id = ? AND code_hash = ? AND used IS NULL`,
      [userId, hash]
    );
    
    if (!codeRow) {
      return false;
    }
    
    await queryRun(
      'UPDATE mfa_backup_codes SET used = NOW() WHERE id = ?',
      [codeRow.id]
    );
    
    return true;
  }

  static async sendMFACode(userId, method) {
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    let message;
    if (method === 'email') {
      message = `Seu código de autenticação de dois fatores para SoftHair é: ${code}`;
      await emailService.send({ 
        to: user.email, 
        subject: 'Código MFA SoftHair', 
        text: message 
      });
    } else if (method === 'sms' && user.telefone) {
      message = `Seu código MFA SoftHair: ${code}`;
      // Lógica para enviar via SMS (Twilio, etc.)
    }
    
    return { message: 'Código MFA enviado' };
  }
}

module.exports = MFAService;
