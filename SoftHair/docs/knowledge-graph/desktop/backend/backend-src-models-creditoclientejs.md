# backend/src/models/CreditoCliente.js

**Repository:** Desktop
**File:** `backend/src/models/CreditoCliente.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/CreditoCliente.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
- [[domains/vendas|vendas]]
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

class CreditoCliente {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO creditos_cliente (id, "clienteId", tipo, valor, descricao, "salonId") VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.clienteId, data.tipo, data.valor, data.descricao||null, salonId]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(`SELECT c.*, cl.nome as "clienteNome" FROM creditos_cliente c LEFT JOIN clientes cl ON c."clienteId" = cl.id WHERE c.id = ?`, [id]);
  }

  static async getByCliente(clienteId, salonId) {
    return query('SELECT * FROM creditos_cliente WHERE "clienteId" = ? AND "salonId" = ? ORDER BY "createdAt" DESC', [clienteId, salonId]);
  }

  static async getSaldo(clienteId, salonId) {
    const row = await queryOne(`
      SELECT COALESCE(SUM(CASE WHEN tipo IN ('credito','fidelidade') THEN valor ELSE 0 END),0) as "totalCreditos",
             COALESCE(SUM(CASE WHEN tipo='debito' THEN valor ELSE 0 END),0) as "totalDebitos"
      FROM creditos_cliente WHERE "clienteId" = ? AND "salonId" = ?
    `, [clienteId, salonId]);
    return (parseFloat(row?.totalCreditos)||0) - (parseFloat(row?.totalDebitos)||0);
  }

  static async getAll(filters = {}, salonId) {
    let sql = `SELECT c.*, cl.nome as "clienteNome" FROM creditos_cliente c LEFT JOIN clientes cl ON c."clienteId" = cl.id WHERE c."salonId" = ?`;
    const params = [salonId];
    if (filters.clienteId) { sql += ' AND c."clienteId" = ?'; params.push(filters.clienteId); }
    if (filters.tipo) { sql += ' AND c.tipo = ?'; params.push(filters.tipo); }
    sql += ' ORDER BY c."createdAt" DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
    return query(sql, params);
  }

  static async getAllWithSaldo(salonId) {
    const clientes = await query('SELECT id, nome, telefone FROM clientes WHERE "salonId" = ? ORDER BY nome', [salonId]);
    const result = [];
    for (const c of clientes) {
      const saldo = await this.getSaldo(c.id, salonId);
      if (saldo !== 0) result.push({ ...c, saldo });
    }
    return result;
  }

  static async delete(id, salonId) {
    await queryRun('DELETE FROM creditos_cliente WHERE id = ? AND "salonId" = ?', [id, salonId]);
    return true;
  }
}

module.exports = CreditoCliente;
```
