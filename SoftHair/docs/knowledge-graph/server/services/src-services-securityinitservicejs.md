# src/services/securityInitService.js

**Repository:** Server
**File:** `src/services/securityInitService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/securityInitService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/saloes|saloes]]
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
    const email = process.env.DEFAULT_ADMIN_EMAIL || '<REDACTED_EMAIL>';

    const exists = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);

    if (exists.rows.length === 0) {
      const password = process.env.DEFAULT_ADMIN_PASSWORD || '<REDACTED_PASSWORD>';
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

      console.log(`✅ Admin padrão criado: ${email} / ${password}`);
    }
  }
}

module.exports = SecurityInitService;
```
