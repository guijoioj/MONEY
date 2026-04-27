# backend/src/scripts/createAdmin.js

**Repository:** Desktop
**File:** `backend/src/scripts/createAdmin.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/scripts/createAdmin.js` do repositório Desktop.

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
require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Salao = require('../models/Salao');
const { pool } = require('../config/database');
const { initDb } = require('../config/initDb');

async function createAdmin() {
  const email = process.argv[2] || process.env.SOFTHAIR_DEFAULT_ADMIN_EMAIL || 'admin@salao.com';
  const password = process.argv[3] || process.env.SOFTHAIR_DEFAULT_ADMIN_PASSWORD || 'admin123';
  const name = process.argv[4] || 'Administrador';

  try {
    console.log('Inicializando banco de dados...');
    await initDb();

    console.log('Verificando se usuário já existe...');
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log(`Usuário ${email} já existe.`);
      process.exit(0);
    }

    console.log('Buscando ou criando salão padrão...');
    let salao = await Salao.findFirst();
    if (!salao) {
      console.log('Criando salão padrão...');
      salao = await Salao.create({
        nome: 'Meu Salão',
        email: email
      });
      console.log(`Salão criado: ${salao.id}`);
    }

    console.log('Criando usuário admin...');
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      role: 'admin',
      salonId: salao.id
    });

    console.log('Admin criado com sucesso!');
    console.log(`Email: ${email}`);
    console.log(`Senha: ${password}`);
    console.log(`Salão ID: ${salao.id}`);
  } catch (error) {
    console.error('Erro ao criar admin:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
```
