const { pool } = require('../config/database');
const crypto = require('crypto');

class SecurityInitService {
  static async initializeSecurity() {
    console.log('🔐 Inicializando segurança do servidor...');

    try {
      // [P3-M2] Validar chaves criptográficas no boot — fail-fast em produção.
      this.validateCryptoKeys();

      // Criar tabelas de segurança
      await this.createSecurityTables();

      // Criar admin padrão se não existir
      await this.createDefaultAdmin();

      // [P7-M1] Iniciar cleanup job da jwt_blacklist — purga entradas expiradas
      // a cada 1h. Sem esse job, a tabela cresce indefinidamente (1 linha por
      // logout/password change/LGPD delete) e ataca o disco em meses.
      this.startJwtBlacklistCleanupJob();

      console.log('✅ Segurança inicializada');
    } catch (error) {
      console.error('❌ Erro na inicialização de segurança:', error);
      throw error;
    }
  }

  // [P7-M1] Cleanup periódico de jwt_blacklist — entradas com expires_at < NOW()
  // já são ignoradas por isTokenRevoked, mas continuam ocupando disco e degradando
  // o índice. Roda a cada 1h. Em ambiente de teste (NODE_ENV=test) ou se a env
  // DISABLE_JWT_CLEANUP_JOB=1, NÃO inicia (evita handle aberto em jest).
  static startJwtBlacklistCleanupJob() {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_JWT_CLEANUP_JOB === '1') {
      return;
    }
    if (this._jwtCleanupInterval) return; // idempotente

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const runCleanup = async () => {
      try {
        const r = await pool.query('DELETE FROM jwt_blacklist WHERE expires_at < NOW()');
        if (r.rowCount > 0) {
          console.log(`[SECURITY] jwt_blacklist cleanup: ${r.rowCount} entradas expiradas removidas`);
        }
      } catch (err) {
        console.error('[SECURITY] jwt_blacklist cleanup falhou:', err.message);
      }
    };

    // Rodar uma vez no boot (não-bloqueante) e depois a cada 1h.
    setImmediate(runCleanup);
    this._jwtCleanupInterval = setInterval(runCleanup, ONE_HOUR_MS);
    // unref para não impedir o processo de encerrar em testes/ctrl-c.
    if (this._jwtCleanupInterval.unref) this._jwtCleanupInterval.unref();
  }

  static stopJwtBlacklistCleanupJob() {
    if (this._jwtCleanupInterval) {
      clearInterval(this._jwtCleanupInterval);
      this._jwtCleanupInterval = null;
    }
  }

  // [P3-M2] Validação fail-fast de ENCRYPTION_KEY (AES-256-GCM = 32 bytes / 64 hex chars)
  // e HMAC_SECRET (>= 32 chars). Em produção, aborta o boot se inválido.
  static validateCryptoKeys() {
    const isProd = process.env.NODE_ENV === 'production';
    const problems = [];

    const encKey = process.env.ENCRYPTION_KEY || '';
    if (encKey) {
      try {
        const buf = Buffer.from(encKey, 'hex');
        if (buf.length !== 32) {
          problems.push(`ENCRYPTION_KEY tem ${buf.length} bytes — esperado 32 (64 hex chars) para AES-256-GCM`);
        }
      } catch {
        problems.push('ENCRYPTION_KEY não é hex válido');
      }
    } else if (isProd) {
      problems.push('ENCRYPTION_KEY não definida em produção');
    }

    const hmac = process.env.HMAC_SECRET || '';
    if (hmac) {
      if (hmac.length < 32) {
        problems.push(`HMAC_SECRET tem ${hmac.length} chars — mínimo 32 recomendado`);
      }
    } else if (isProd) {
      problems.push('HMAC_SECRET não definido em produção');
    }

    if (!process.env.JWT_SECRET) {
      problems.push('JWT_SECRET não definido');
    } else if (process.env.JWT_SECRET.length < 32 && isProd) {
      problems.push(`JWT_SECRET tem ${process.env.JWT_SECRET.length} chars — mínimo 32 em produção`);
    }

    // [P6-M1] BACKUP_ENCRYPTION_KEY obrigatória em produção
    if (isProd && !process.env.BACKUP_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) {
      problems.push('BACKUP_ENCRYPTION_KEY (ou ENCRYPTION_KEY) ausente em produção — backups em plaintext serão recusados');
    }

    if (problems.length) {
      const msg = `[SECURITY] Problemas com chaves criptográficas:\n  - ${problems.join('\n  - ')}`;
      if (isProd) {
        console.error(msg);
        throw new Error('Chaves criptográficas inválidas — abortando boot em produção');
      } else {
        console.warn(msg);
      }
    } else {
      console.log('🔑 Chaves criptográficas validadas');
    }
  }

  static async createSecurityTables() {
    const sql = `
      CREATE TABLE IF NOT EXISTS security_logs (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        usuario_id INTEGER,
        salao_id INTEGER,
        ip VARCHAR(45),
        user_agent TEXT,
        endpoint VARCHAR(255),
        metodo VARCHAR(10),
        status_code INTEGER,
        mensagem TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        ip VARCHAR(45),
        sucesso BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS jwt_blacklist (
        id SERIAL PRIMARY KEY,
        jti VARCHAR(255) UNIQUE,
        user_id INTEGER,
        salao_id INTEGER,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
        ON login_attempts(email, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_jti ON jwt_blacklist(jti);
    `;

    await pool.query(sql);
  }

  static async createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@softhair.com';
    const isProduction = process.env.NODE_ENV === 'production';

    const exists = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);

    if (exists.rows.length > 0) {
      return;
    }

    // Em produção: NÃO criar admin automaticamente sem DEFAULT_ADMIN_PASSWORD.
    if (isProduction && !process.env.DEFAULT_ADMIN_PASSWORD) {
      console.warn(
        '⚠️  [SECURITY] Admin padrão NÃO foi criado em produção: defina DEFAULT_ADMIN_PASSWORD (>=10 chars) ' +
        'na env e rode novamente, ou crie o admin via script manual de bootstrap.'
      );
      return;
    }

    let password = process.env.DEFAULT_ADMIN_PASSWORD;
    let generated = false;

    if (!password) {
      // Dev: gerar senha aleatória forte e imprimir uma única vez
      password = crypto.randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 20) + 'A1';
      generated = true;
    }

    if (password.length < 10) {
      throw new Error('DEFAULT_ADMIN_PASSWORD muito curta (mínimo 10 caracteres).');
    }

    const hash = await bcrypt.hash(password, 12);

    // Criar salão padrão
    const salaoResult = await pool.query(
      `INSERT INTO saloes (nome, email, ativo) VALUES ($1, $2, true) RETURNING id`,
      ['Salão Padrão', email]
    );
    const salaoId = salaoResult.rows[0].id;

    // Criar admin
    await pool.query(
      `INSERT INTO usuarios (email, senha_hash, nome, tipo, salao_id, ativo)
       VALUES ($1, $2, $3, 'admin', $4, true)`,
      [email, hash, process.env.DEFAULT_ADMIN_NAME || 'Administrador', salaoId]
    );

    console.log(`✅ Admin padrão criado: ${email}`);
    if (generated) {
      console.warn('━'.repeat(70));
      console.warn('🔐 SENHA TEMPORÁRIA GERADA (printed once — copie agora):');
      console.warn(`    Email:  ${email}`);
      console.warn(`    Senha:  ${password}`);
      console.warn('   Defina DEFAULT_ADMIN_PASSWORD na env para senha fixa e troque após o primeiro login.');
      console.warn('━'.repeat(70));
    }
  }
}

module.exports = SecurityInitService;
