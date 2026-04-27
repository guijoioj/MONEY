# backend/src/models/Salao.js

**Repository:** Desktop
**File:** `backend/src/models/Salao.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/Salao.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

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
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class Salao {
  static async create(data) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO saloes (id, nome, email, telefone, endereco, cidade, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.nome, data.email, data.telefone || null, data.endereco || null, data.cidade || null, data.estado || null]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM saloes WHERE id = ?', [id]);
  }

  static async findByEmail(email) {
    return queryOne('SELECT * FROM saloes WHERE email = ?', [email]);
  }

  static async findFirst() {
    return queryOne('SELECT * FROM saloes LIMIT 1');
  }

  static async getAll(filters = {}) {
    let sql = 'SELECT * FROM saloes WHERE ativo = true';
    const params = [];
    if (filters.search) {
      sql += ' AND (nome ILIKE ? OR cidade ILIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    sql += ' ORDER BY nome ASC';
    return query(sql, params);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['nome', 'telefone', 'endereco', 'cidade', 'estado', 'foto', 'plano', 'ativo'];
    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(v); }
    }
    if (!fields.length) return this.findById(id);
    fields.push('"updatedAt" = NOW()');
    values.push(id);
    await queryRun(`UPDATE saloes SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }
}

module.exports = Salao;
```
