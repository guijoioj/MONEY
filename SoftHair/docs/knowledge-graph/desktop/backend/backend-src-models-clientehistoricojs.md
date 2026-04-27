# backend/src/models/ClienteHistorico.js

**Repository:** Desktop
**File:** `backend/src/models/ClienteHistorico.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/ClienteHistorico.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
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

class ClienteHistorico {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO cliente_historico (id, "clienteId", tipo, descricao, "entidadeId", data, "salonId") VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.clienteId, data.tipo, data.descricao, data.entidadeId||null, data.data||new Date().toISOString(), salonId]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM cliente_historico WHERE id = ?', [id]);
  }

  static async getByCliente(clienteId, filters = {}, salonId) {
    let sql = 'SELECT * FROM cliente_historico WHERE "clienteId" = ? AND "salonId" = ?';
    const params = [clienteId, salonId];
    if (filters.tipo) { sql += ' AND tipo = ?'; params.push(filters.tipo); }
    sql += ' ORDER BY data DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
    return query(sql, params);
  }

  static async getResumo(clienteId, salonId) {
    const fechamentos = await query(`
      SELECT f.*, p.nome as "profissionalNome"
      FROM fechamentos f
      LEFT JOIN profissionais p ON p.id = f."profissionalId"
      WHERE f."clienteId" = ? AND f."salonId" = ?
      ORDER BY f.data DESC
    `, [clienteId, salonId]);

    const totalGastoServicos = fechamentos.reduce((s,f) => s+(f.totalAtendimentos||0), 0);
    const totalGastoProdutos = fechamentos.reduce((s,f) => s+(f.totalVendas||0), 0);

    const profissionaisFavoritosRaw = await query(`
      SELECT p.nome, COUNT(*) as count
      FROM fechamentos f JOIN profissionais p ON p.id = f."profissionalId"
      WHERE f."clienteId" = ? AND f."salonId" = ? AND f."profissionalId" IS NOT NULL
      GROUP BY p.id, p.nome ORDER BY count DESC LIMIT 3
    `, [clienteId, salonId]);

    const servicosFavoritos = await query(`
      SELECT nome, categoria, quantidade, "totalGasto"
      FROM cliente_favoritos WHERE "clienteId" = ? AND "salonId" = ? AND tipo = 'servico'
      ORDER BY quantidade DESC LIMIT 5
    `, [clienteId, salonId]);

    const produtosFavoritos = await query(`
      SELECT nome, categoria, quantidade, "totalGasto"
      FROM cliente_favoritos WHERE "clienteId" = ? AND "salonId" = ? AND tipo = 'produto'
      ORDER BY quantidade DESC LIMIT 5
    `, [clienteId, salonId]);

    return {
      atendimentos: fechamentos, vendas: fechamentos,
      servicosFavoritos, produtosFavoritos,
      profissionaisFavoritos: profissionaisFavoritosRaw.map(p => ({ nome: p.nome, count: parseInt(p.count) })),
      totalAtendimentos: fechamentos.filter(f=>(f.totalAtendimentos||0)>0).length,
      totalVendas: fechamentos.filter(f=>(f.totalVendas||0)>0).length,
      totalGastoServicos, totalGastoProdutos
    };
  }

  static async delete(id) { return queryRun('DELETE FROM cliente_historico WHERE id = ?', [id]); }
  static async deleteByCliente(clienteId, salonId) {
    return queryRun('DELETE FROM cliente_historico WHERE "clienteId" = ? AND "salonId" = ?', [clienteId, salonId]);
  }
}

module.exports = ClienteHistorico;
```
