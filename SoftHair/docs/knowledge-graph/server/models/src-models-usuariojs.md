# src/models/Usuario.js

**Repository:** Server
**File:** `src/models/Usuario.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Usuario.js` do repositório Server.

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
const BaseModel = require('./BaseModel');

class Usuario extends BaseModel {
  constructor() {
    super('usuarios');
  }

  async findByEmail(email) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
      [email]
    );
  }

  async findBySalaoId(salaoId) {
    const { query } = require('../config/database');
    return await query(
      'SELECT * FROM usuarios WHERE salao_id = $1 AND ativo = true ORDER BY nome',
      [salaoId]
    );
  }

  async updateLastAccess(userId) {
    const { query } = require('../config/database');
    return await query(
      'UPDATE usuarios SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  async updatePassword(userId, hashedPassword) {
    const { query } = require('../config/database');
    return await query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
  }
}

module.exports = Usuario;
```
