# src/models/Venda.js

**Repository:** Server
**File:** `src/models/Venda.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Venda.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
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
const BaseModel = require('./BaseModel');

class Venda extends BaseModel {
  constructor() {
    super('vendas');
  }

  async findByPeriod(startDate, endDate, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT * FROM vendas 
       WHERE salao_id = $1 
       AND DATE(created_at) BETWEEN $2 AND $3 
       ORDER BY created_at DESC`,
      [salaoId, startDate, endDate]
    );
  }

  async findByCliente(clienteId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT * FROM vendas 
       WHERE cliente_id = $1 AND salao_id = $2 
       ORDER BY created_at DESC`,
      [clienteId, salaoId]
    );
  }

  async findByProfissional(profissionalId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT * FROM vendas 
       WHERE profissional_id = $1 AND salao_id = $2 
       ORDER BY created_at DESC`,
      [profissionalId, salaoId]
    );
  }

  async getTotalVendasPorPeriodo(startDate, endDate, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total 
       FROM vendas 
       WHERE salao_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
      [salaoId, startDate, endDate]
    );
  }

  async cancelar(id, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      `UPDATE vendas SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND salao_id = $2 RETURNING *`,
      [id, salaoId]
    );
  }
}

module.exports = Venda;
```
