# src/scripts/initDb.js

**Repository:** Server
**File:** `src/scripts/initDb.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/scripts/initDb.js` do repositório Server.

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

- [[mobile/entities/softhair-dffdf835|SoftHair]]

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
#!/usr/bin/env node

require('@oo/env').config({path: require('path').resolve(__dirname, '../../.env')});
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function createDatabase() {
  console.log('🚀 Inicializando banco de dados SoftHair...');
  
  try {
    const databaseConfig = require('../config/database');
    const initDb = require('../config/initDb');
    
    console.log('📊 Criando tabelas e estruturas...');
    await initDb();
    
    console.log('🔧 Criando admin padrão...');
    await createDefaultAdmin();
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
    process.exit(1);
  }
}

async function createDefaultAdmin() {
  try {
    const { queryOne, withTransaction } = require('../config/database');
    const bcrypt = require('bcryptjs');
    
    await withTransaction(async (client) => {
      const salao = await client.query(
        `INSERT INTO saloes (nome, email)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
        ['SoftHair Dev', '<REDACTED_EMAIL>']
      );
      
      if (salao.rows.length > 0) {
        const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || '<REDACTED_PASSWORD>', 10);
        
        await client.query(
          `INSERT INTO usuarios (nome, email, senha_hash, salao_id, tipo)
           VALUES ($1, $2, $3, $4, $5)`,
          ['Administrador', '<REDACTED_EMAIL>', hashedPassword, salao.rows[0].id, 'admin']
        );
      }
    });
    
    console.log('✅ Admin padrão criado (<REDACTED_EMAIL>)');
  } catch (error) {
    console.warn('⚠️ Admin padrão já existe ou erro ao criar:', error.message);
  }
}

// Execute if run directly
if (require.main === module) {
  createDatabase().catch(console.error);
}

module.exports = createDatabase;
```
