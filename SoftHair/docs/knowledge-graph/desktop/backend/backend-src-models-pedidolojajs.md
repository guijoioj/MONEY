# backend/src/models/PedidoLoja.js

**Repository:** Desktop
**File:** `backend/src/models/PedidoLoja.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/PedidoLoja.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
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

class PedidoLoja {
  static async create(data, itens) {
    const id = uuidv4();
    await queryRun(
      `INSERT INTO pedidos_loja (id,"salonId","clienteAppId",status,total,"enderecoEntrega","formaPagamento",observacoes) VALUES (?,?,?,?,?,?,?,?)`,
      [id, data.salonId, data.clienteAppId, 'pendente', data.total, data.enderecoEntrega||null, data.formaPagamento||null, data.observacoes||null]
    );
    for (const item of itens) {
      await queryRun(
        'INSERT INTO pedidos_loja_itens (id,"pedidoId","produtoId",quantidade,"precoUnitario",subtotal) VALUES (?,?,?,?,?,?)',
        [uuidv4(), id, item.produtoId, item.quantidade, item.precoUnitario, item.subtotal]
      );
    }
    return this.findById(id);
  }

  static async findById(id) {
    const pedido = await queryOne(`
      SELECT pl.*, ca.nome as "clienteNome", ca.telefone as "clienteTelefone", sl.nome as "salaoNome"
      FROM pedidos_loja pl
      LEFT JOIN clientes_app ca ON pl."clienteAppId" = ca.id
      LEFT JOIN saloes sl ON pl."salonId" = sl.id
      WHERE pl.id = ?
    `, [id]);
    if (!pedido) return null;
    pedido.itens = await query(`
      SELECT pli.*, p.nome as "produtoNome"
      FROM pedidos_loja_itens pli LEFT JOIN produtos p ON pli."produtoId" = p.id
      WHERE pli."pedidoId" = ?
    `, [id]);
    return pedido;
  }

  static async getByCliente(clienteAppId) {
    const pedidos = await query(`
      SELECT pl.*, sl.nome as "salaoNome" FROM pedidos_loja pl
      LEFT JOIN saloes sl ON pl."salonId" = sl.id
      WHERE pl."clienteAppId" = ? ORDER BY pl."createdAt" DESC
    `, [clienteAppId]);
    for (const p of pedidos) {
      p.itens = await query('SELECT pli.*, pr.nome as "produtoNome" FROM pedidos_loja_itens pli LEFT JOIN produtos pr ON pli."produtoId"=pr.id WHERE pli."pedidoId"=?', [p.id]);
    }
    return pedidos;
  }

  static async getBySalao(salonId, filters = {}) {
    let sql = `SELECT pl.*, ca.nome as "clienteNome", ca.telefone as "clienteTelefone" FROM pedidos_loja pl LEFT JOIN clientes_app ca ON pl."clienteAppId"=ca.id WHERE pl."salonId"=?`;
    const params = [salonId];
    if (filters.status) { sql += ' AND pl.status=?'; params.push(filters.status); }
    sql += ' ORDER BY pl."createdAt" DESC';
    const pedidos = await query(sql, params);
    for (const p of pedidos) {
      p.itens = await query('SELECT pli.*, pr.nome as "produtoNome" FROM pedidos_loja_itens pli LEFT JOIN produtos pr ON pli."produtoId"=pr.id WHERE pli."pedidoId"=?', [p.id]);
    }
    return pedidos;
  }

  static async atualizarStatus(id, salonId, status) {
    await queryRun('UPDATE pedidos_loja SET status=?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?', [status, id, salonId]);
    return this.findById(id);
  }
}

module.exports = PedidoLoja;
```
