# backend/src/services/bootstrapService.js

**Repository:** Desktop
**File:** `backend/src/services/bootstrapService.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/services/bootstrapService.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Salao = require('../models/Salao');
const { queryOne, queryRun } = require('../config/database');

const DEFAULT_JWT_SECRET = 'softHair-dev-jwt-secret-change-me';
const DEFAULT_JWT_EXPIRES_IN = '7d';
const DEFAULT_ADMIN_EMAIL = '<REDACTED_EMAIL>';
const DEFAULT_ADMIN_PASSWORD = '<REDACTED_PASSWORD>';
const DEFAULT_ADMIN_NAME = 'Administrador';
const DEFAULT_SALON_NAME = 'Meu Salão';

class BootstrapService {
  static ensureRuntimeEnvironment() {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
      console.log('JWT_SECRET não definido. Usando chave padrão apenas para ambiente de desenvolvimento.');
    }
    if (!process.env.JWT_EXPIRES_IN) {
      process.env.JWT_EXPIRES_IN = DEFAULT_JWT_EXPIRES_IN;
    }
  }

  static async ensureDefaultAdmin() {
    let salao = await queryOne('SELECT * FROM saloes LIMIT 1');

    if (!salao) {
      const salaoId = uuidv4();
      const adminEmail = process.env.SOFTHAIR_DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
      await queryRun(
        'INSERT INTO saloes (id, nome, email) VALUES (?, ?, ?)',
        [salaoId, DEFAULT_SALON_NAME, adminEmail]
      );
      salao = await queryOne('SELECT * FROM saloes WHERE id = ?', [salaoId]);
      console.log(`Salão padrão criado: ${DEFAULT_SALON_NAME}`);
    }

    const total = await User.count();
    if (total > 0) {
      await queryRun('UPDATE users SET "salonId" = ? WHERE "salonId" IS NULL', [salao.id]);
      return;
    }

    const email = process.env.SOFTHAIR_DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
    const password = process.env.SOFTHAIR_DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
    const name = process.env.SOFTHAIR_DEFAULT_ADMIN_NAME || DEFAULT_ADMIN_NAME;

    try {
      const hashedPassword = bcrypt.hashSync(password, 12);
      await User.create({ email, password: hashedPassword, name, role: 'admin', salonId: salao.id });
      console.log(`Usuário padrão criado: ${email} (salão: ${salao.nome})`);
    } catch (error) {
      console.error('Falha ao criar usuário padrão:', error.message);
    }
  }

  static getJwtConfig() {
    return {
      secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
    };
  }
}

module.exports = BootstrapService;
```
