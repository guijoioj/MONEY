const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne, withTransaction } = require('../config/database');

class AuthService {
  /**
   * Registrar novo salão com admin (transacional)
   */
  static async registerSalao({ nome, endereco, telefone, email, cnpj, adminEmail, adminSenha, adminNome }) {
    const hashedPassword = await bcrypt.hash(adminSenha, 12);

    return await withTransaction(async (client) => {
      // Verificar se email do admin já existe
      const existingUser = await client.query(
        'SELECT id FROM usuarios WHERE email = $1',
        [adminEmail]
      );
      if (existingUser.rows.length > 0) {
        throw new Error('Email do administrador já está em uso');
      }

      // Criar salão
      const salaoResult = await client.query(
        `INSERT INTO saloes (nome, endereco, telefone, email, cnpj)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nome, endereco, telefone, email, cnpj]
      );
      const salao = salaoResult.rows[0];

      // Criar admin
      const userResult = await client.query(
        `INSERT INTO usuarios (email, senha_hash, nome, tipo, salao_id)
         VALUES ($1, $2, $3, 'admin', $4) RETURNING id, email, nome, tipo, salao_id, created_at`,
        [adminEmail, hashedPassword, adminNome, salao.id]
      );
      const admin = userResult.rows[0];

      // Gerar token para login imediato
      const token = this.generateToken({
        id: admin.id,
        email: admin.email,
        tipo: admin.tipo,
        salao_id: salao.id
      });

      return { salao, admin, token };
    });
  }

  /**
   * Login com email e senha
   */
  static async login(email, senha) {
    const user = await queryOne(
      `SELECT u.*, s.nome as salao_nome, s.ativo as salao_ativo
       FROM usuarios u
       JOIN saloes s ON s.id = u.salao_id
       WHERE u.email = $1 AND u.ativo = true`,
      [email]
    );

    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    const validPassword = await bcrypt.compare(senha, user.senha_hash);
    if (!validPassword) {
      throw new Error('Credenciais inválidas');
    }

    if (!user.salao_ativo) {
      throw new Error('Salão inativo');
    }

    // Atualizar último acesso
    await query(
      'UPDATE usuarios SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        tipo: user.tipo,
        salao_id: user.salao_id,
        salao_nome: user.salao_nome
      }
    };
  }

  /**
   * Gerar token JWT
   * [A3] JWT curto (default 24h) + jti para permitir revogação via jwt_blacklist.
   */
  static generateToken(user) {
    const crypto = require('crypto');
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tipo: user.tipo,
        salaoId: user.salao_id,
        jti: crypto.randomBytes(16).toString('hex'),
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }

  /**
   * Verificar token JWT
   */
  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  /**
   * Revogar token (logout) — adiciona jti à blacklist até a expiração natural.
   */
  static async revokeToken(decodedOrToken) {
    let decoded = decodedOrToken;
    if (typeof decodedOrToken === 'string') {
      try { decoded = jwt.decode(decodedOrToken); } catch { return false; }
    }
    if (!decoded || !decoded.jti || !decoded.exp) return false;
    try {
      await query(
        `INSERT INTO jwt_blacklist (jti, user_id, salao_id, expires_at)
         VALUES ($1, $2, $3, to_timestamp($4))
         ON CONFLICT (jti) DO NOTHING`,
        [decoded.jti, decoded.userId || null, decoded.salaoId || null, decoded.exp]
      );
      return true;
    } catch (e) {
      console.error('[revokeToken] erro:', e.message);
      return false;
    }
  }

  /**
   * Checa se jti está revogado.
   */
  static async isTokenRevoked(decoded) {
    if (!decoded?.jti) return false;
    try {
      const row = await queryOne(
        'SELECT 1 FROM jwt_blacklist WHERE jti = $1 AND expires_at > NOW()',
        [decoded.jti]
      );
      return !!row;
    } catch {
      return false; // não bloqueia em caso de erro de DB
    }
  }

  /**
   * Registrar dispositivo cliente (mobile/desktop)
   */
  static async registerDevice({ salaoId, tipo, nome, fingerprint, info }) {
    const result = await query(
      `INSERT INTO devices (salao_id, tipo, nome, fingerprint, info)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (fingerprint) DO UPDATE
       SET salao_id = $1, tipo = $2, nome = $3, info = $5, ativo = true
       RETURNING *`,
      [salaoId, tipo, nome, fingerprint, JSON.stringify(info)]
    );
    return result[0];
  }

  /**
   * Validar dispositivo por fingerprint
   */
  static async validateDevice(fingerprint) {
    const device = await queryOne(
      `SELECT d.*, s.nome as salao_nome, s.ativo as salao_ativo
       FROM devices d
       JOIN saloes s ON s.id = d.salao_id
       WHERE d.fingerprint = $1 AND d.ativo = true`,
      [fingerprint]
    );

    if (!device) {
      throw new Error('Dispositivo não autorizado');
    }

    if (!device.salao_ativo) {
      throw new Error('Salão inativo');
    }

    await query(
      'UPDATE devices SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = $1',
      [device.id]
    );

    return device;
  }

  /**
   * Criar API Key (apenas admin)
   */
  static async createApiKey({ salaoId, nome, permissoes, expiresAt }) {
    const key = require('crypto').randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO api_keys (salao_id, chave, nome, permissoes, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [salaoId, key, nome, JSON.stringify(permissoes || []), expiresAt]
    );

    return { ...result[0], chave: key };
  }

  /**
   * Validar API Key
   */
  static async validateApiKey(key) {
    const apiKey = await queryOne(
      `SELECT * FROM api_keys
       WHERE chave = $1 AND ativo = true
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [key]
    );

    if (!apiKey) {
      throw new Error('API Key inválida ou expirada');
    }

    await query(
      'UPDATE api_keys SET ultimo_uso = CURRENT_TIMESTAMP WHERE id = $1',
      [apiKey.id]
    );

    return apiKey;
  }

  /**
   * Alterar senha
   */
  static async changePassword(userId, oldPassword, newPassword) {
    const user = await queryOne('SELECT * FROM usuarios WHERE id = $1', [userId]);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const validPassword = await bcrypt.compare(oldPassword, user.senha_hash);
    if (!validPassword) {
      throw new Error('Senha atual incorreta');
    }

    if (newPassword.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      throw new Error('Nova senha precisa de mínimo 8 caracteres, com letra e número');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE usuarios SET senha_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    return true;
  }
}

module.exports = AuthService;