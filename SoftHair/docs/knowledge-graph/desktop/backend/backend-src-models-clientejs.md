# backend/src/models/Cliente.js

**Repository:** Desktop
**File:** `backend/src/models/Cliente.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/Cliente.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
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

class Cliente {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO clientes (id, nome, email, telefone, cpf, "dataNascimento", endereco, observacoes, "salonId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.nome, data.email||null, data.telefone, data.cpf||null, data.dataNascimento||null, data.endereco||null, data.observacoes||null, salonId]
    );
    return this.findById(id, salonId);
  }

  static async findById(id, salonId) {
    return queryOne('SELECT * FROM clientes WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = 'SELECT * FROM clientes WHERE "salonId" = ?';
    const params = [salonId];
    if (filters.search) {
      sql += ' AND (nome ILIKE ? OR telefone ILIKE ? OR email ILIKE ?)';
      const s = `%${filters.search}%`; params.push(s, s, s);
    }
    sql += ' ORDER BY nome ASC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
    if (filters.offset) { sql += ' OFFSET ?'; params.push(parseInt(filters.offset)); }
    return query(sql, params);
  }

  static async update(id, data, salonId) {
    const fields = [], values = [];
    const allowed = ['nome','email','telefone','cpf','dataNascimento','endereco','observacoes'];
    for (const [k,v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(v); }
    }
    if (!fields.length) return this.findById(id, salonId);
    fields.push('"updatedAt" = NOW()');
    values.push(id, salonId);
    await queryRun(`UPDATE clientes SET ${fields.join(', ')} WHERE id = ? AND "salonId" = ?`, values);
    return this.findById(id, salonId);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM clientes WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async count(filters = {}, salonId) {
    let sql = 'SELECT COUNT(*) as count FROM clientes WHERE "salonId" = ?';
    const params = [salonId];
    if (filters.search) {
      sql += ' AND (nome ILIKE ? OR telefone ILIKE ? OR email ILIKE ?)';
      const s = `%${filters.search}%`; params.push(s, s, s);
    }
    const row = await queryOne(sql, params);
    return parseInt(row?.count || 0);
  }
}

module.exports = Cliente;
```
