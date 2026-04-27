const SecurityService = require('./securityService');
const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

class SecurityInitService {
  static async initializeSecurity() {
    console.log('🔐 Inicializando camadas de segurança...');

    try {
      // 1. Verificar variáveis de ambiente obrigatórias
      await this.validateEnvironmentVariables();

      // 2. Executar SQL de segurança
      await this.executeSecuritySQL();

      // 3. Configurar jobs de manutenção (cria as funções necessárias)
      await this.setupMaintenanceJobs();

      // 4. Limpar tokens expirados (depende da função criada no passo 3)
      await this.cleanupExpiredTokens();

      // 5. Validar certificados SSL
      await this.validateSSLCertificates();

      // 6. Registrar inicialização bem-sucedida
      await SecurityService.logSecurityEvent({
        type: 'SECURITY_INITIALIZATION',
        message: 'Todas as camadas de segurança inicializadas com sucesso',
        additionalData: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          sslEnabled: process.env.FORCE_HTTPS === 'true',
          rateLimitingEnabled: true,
          encryptionEnabled: true,
        }
      });

      console.log('✅ Todas as camadas de segurança foram inicializadas com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar segurança:', error);
      throw error;
    }
  }

  static async validateEnvironmentVariables() {
    const requiredVars = [
      'JWT_SECRET',
      'API_KEY',
      'HMAC_SECRET',
      'ENCRYPTION_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${missingVars.join(', ')}`);
    }

    // Gerar chaves automaticamente se estiver em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      if (!process.env.API_KEY) {
        process.env.API_KEY = 'dev_key_' + require('crypto').randomBytes(32).toString('hex');
      }
      if (!process.env.HMAC_SECRET) {
        process.env.HMAC_SECRET = require('crypto').randomBytes(64).toString('hex');
      }
    }

    console.log('✅ Variáveis de ambiente validadas');
  }

  static async executeSecuritySQL() {
    const sqlPath = path.join(__dirname, '../config/security.sql');

    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      const statements = this.splitSQLStatements(sql);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.warn('⚠️  Erro ao executar SQL:', error.message);
            }
          }
        }
      }

      console.log('✅ SQL de segurança executado');
    }
  }

  static splitSQLStatements(sql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';
    let i = 0;

    while (i < sql.length) {
      // Check for dollar-quote start/end
      if (!inDollarQuote) {
        const match = sql.slice(i).match(/^(\$[^$]*\$)/);
        if (match) {
          inDollarQuote = true;
          dollarTag = match[1];
          current += dollarTag;
          i += dollarTag.length;
          continue;
        }
      } else {
        if (sql.slice(i).startsWith(dollarTag)) {
          inDollarQuote = false;
          current += dollarTag;
          i += dollarTag.length;
          dollarTag = '';
          continue;
        }
      }

      const ch = sql[i];
      if (ch === ';' && !inDollarQuote) {
        statements.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
      i++;
    }

    if (current.trim()) statements.push(current.trim());
    return statements.filter(s => s.length > 0);
  }

  static async cleanupExpiredTokens() {
    try {
      await pool.query('SELECT limpar_tokens_revogados_expirados()');
      console.log('✅ Tokens expirados limpos');
    } catch (error) {
      console.warn('⚠️  Erro ao limpar tokens expirados:', error.message);
    }
  }

  static async setupMaintenanceJobs() {
    // Configurar limpeza automática de logs antigos (executada diariamente)
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION limpar_logs_antigos()
        RETURNS VOID AS $func$
        BEGIN
          DELETE FROM logs_seguranca WHERE criado_em < NOW() - INTERVAL '30 days';
          DELETE FROM tentativas_login WHERE criado_em < NOW() - INTERVAL '30 days';
          DELETE FROM dispositivos WHERE ativo = false AND ultimo_acesso < NOW() - INTERVAL '90 days';
        END;
        $func$ LANGUAGE plpgsql;
      `);

      // Agendar limpeza diária (se pg_cron estiver disponível)
      try {
        await pool.query(`
          SELECT cron.schedule('limpeza-diaria-seguranca', '0 2 * * *', 'SELECT limpar_logs_antigos();')
        `);
        console.log('✅ Job de limpeza diária configurado');
      } catch (error) {
        console.log('ℹ️  pg_cron não disponível, limpeza manual necessária');
      }
    } catch (error) {
      console.warn('⚠️  Erro ao configurar jobs de manutenção:', error.message);
    }
  }

  static async validateSSLCertificates() {
    if (process.env.FORCE_HTTPS === 'true') {
      const certFiles = [
        '/etc/ssl/private/softhair.key',
        '/etc/ssl/certs/softhair.crt',
        '/etc/ssl/certs/softhair-ca.crt'
      ];

      const missingCerts = certFiles.filter(cert => !fs.existsSync(cert));

      if (missingCerts.length > 0) {
        console.warn('⚠️  Certificados SSL não encontrados. Gerando certificados autoassinados para desenvolvimento...');

        // Gerar certificados autoassinados para desenvolvimento
        if (process.env.NODE_ENV !== 'production') {
          await this.generateSelfSignedCertificates();
        } else {
          throw new Error('Certificados SSL obrigatórios em produção');
        }
      } else {
        console.log('✅ Certificados SSL validados');
      }
    }
  }

  static async generateSelfSignedCertificates() {
    try {
      const { execSync } = require('child_process');
      const certDir = '/etc/ssl';

      // Criar diretório se não existir
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }

      // Gerar chave privada
      execSync(`openssl genrsa -out ${certDir}/private/softhair.key 2048`);

      // Gerar certificado autoassinado válido por 1 ano
      execSync(`openssl req -new -x509 -key ${certDir}/private/softhair.key -out ${certDir}/certs/softhair.crt -days 365 -subj "/C=BR/ST=SP/L=SaoPaulo/O=SoftHair/CN=localhost"`);

      // Copiar como CA
      fs.copyFileSync(`${certDir}/certs/softhair.crt`, `${certDir}/certs/softhair-ca.crt`);

      console.log('✅ Certificados autoassinados gerados para desenvolvimento');
    } catch (error) {
      console.error('❌ Erro ao gerar certificados:', error.message);
    }
  }

  static async getSecurityStatus() {
    try {
      const result = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM logs_seguranca WHERE criado_em > NOW() - INTERVAL '24 hours') as logs_24h,
          (SELECT COUNT(*) FROM tentativas_login WHERE sucesso = false AND criado_em > NOW() - INTERVAL '24 hours') as failed_logins_24h,
          (SELECT COUNT(*) FROM dispositivos WHERE ativo = true) as active_devices,
          (SELECT COUNT(*) FROM users WHERE bloqueado = true) as blocked_users
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Erro ao obter status de segurança:', error);
      return null;
    }
  }
}

module.exports = SecurityInitService;