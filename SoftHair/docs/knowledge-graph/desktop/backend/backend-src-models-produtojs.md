# backend/src/models/Produto.js

**Repository:** Desktop
**File:** `backend/src/models/Produto.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/Produto.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
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

class Produto {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO produtos (id, nome, descricao, marca, categoria, "precoVenda", estoque, "estoqueMinimo", ativo, unidade, "baseComissao", "comissaoPorcentagem", "salonId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.nome, data.descricao||null, data.marca||null, data.categoria||null, data.precoVenda, data.estoque||0, data.estoqueMinimo||0, data.ativo!==undefined?(data.ativo?1:0):1, data.unidade||'un', data.baseComissao||0, data.comissaoPorcentagem||0, salonId]
    );
    return this.findById(id, salonId);
  }

  static async findById(id, salonId) {
    const sql = salonId ? 'SELECT * FROM produtos WHERE id = ? AND "salonId" = ?' : 'SELECT * FROM produtos WHERE id = ?';
    return queryOne(sql, salonId ? [id, salonId] : [id]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = 'SELECT * FROM produtos WHERE "salonId" = ?';
    const params = [salonId];
    if (filters.categoria) { sql += ' AND categoria = ?'; params.push(filters.categoria); }
    if (filters.ativo !== undefined) {
      if (filters.ativo === 'false' || filters.ativo === false) { sql += ' AND ativo = 0'; }
      else if (filters.ativo === 'true' || filters.ativo === true) { sql += ' AND ativo = 1'; }
    }
    if (filters.search) { sql += ' AND (nome ILIKE ? OR descricao ILIKE ? OR marca ILIKE ?)'; const s=`%${filters.search}%`; params.push(s,s,s); }
    if (filters.estoqueBaixo === true || filters.estoqueBaixo === 'true') { sql += ' AND estoque <= "estoqueMinimo"'; }
    sql += ' ORDER BY nome ASC';
    return query(sql, params);
  }

  static async update(id, data, salonId) {
    const fields = [], values = [];
    const allowed = ['nome','descricao','marca','categoria','precoVenda','estoque','estoqueMinimo','ativo','unidade','baseComissao','comissaoPorcentagem'];
    for (const [k,v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(k==='ativo'?(v?1:0):v); }
    }
    if (!fields.length) return this.findById(id, salonId);
    fields.push('"updatedAt" = NOW()');
    values.push(id, salonId);
    await queryRun(`UPDATE produtos SET ${fields.join(', ')} WHERE id = ? AND "salonId" = ?`, values);
    return this.findById(id, salonId);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM produtos WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async updateEstoque(id, quantidade, salonId) {
    await queryRun('UPDATE produtos SET estoque = estoque + ?, "updatedAt" = NOW() WHERE id = ? AND "salonId" = ?', [quantidade, id, salonId]);
    return this.findById(id, salonId);
  }

  static async getCategorias(salonId) {
    const rows = await query("SELECT DISTINCT categoria FROM produtos WHERE \"salonId\" = ? AND categoria IS NOT NULL AND categoria <> ''", [salonId]);
    return rows.map(r => r.categoria);
  }

  static async getEstoqueBaixo(salonId) {
    return query('SELECT * FROM produtos WHERE estoque <= "estoqueMinimo" AND ativo = 1 AND "salonId" = ?', [salonId]);
  }
}

module.exports = Produto;
```
