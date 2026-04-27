const { pool } = require('../config/database');

class SecurityInitService {
  static async initializeSecurity() {
    console.log('🔐 Inicializando segurança do servidor...');

    try {
      // Criar tabelas de segurança
      await this.createSecurityTables();

      // Criar admin padrão se não existir
      await this.createDefaultAdmin();

      console.log('✅ Segurança inicializada');
    } catch (error) {
      console.error('❌ Erro na inicialização de segurança:', error);
      throw error;
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
    `;

    await pool.query(sql);
  }

  static async createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@softhair.com';

    const exists = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);

    if (exists.rows.length === 0) {
      const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const hash = await bcrypt.hash(password, 10);

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
      if (!process.env.DEFAULT_ADMIN_PASSWORD) {
        console.warn(`⚠️ ALERTA: Admin criado com a senha padrão insegura. Altere imediatamente!`);
      }
    }
  }
}

module.exports = SecurityInitService;
