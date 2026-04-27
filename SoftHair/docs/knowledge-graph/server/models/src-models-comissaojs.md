# src/models/Comissao.js

**Repository:** Server
**File:** `src/models/Comissao.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Comissao.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/profissionais|profissionais]]
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
const BaseModel = require('./BaseModel');

class Comissao extends BaseModel {
  constructor() {
    super('comissoes');
  }

  async findByProfissional(profissionalId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT c.* 
       FROM comissoes c
       JOIN profissionais p ON p.id = c.profissional_id
       WHERE c.profissional_id = $1 AND p.salao_id = $2
       ORDER BY c.created_at DESC`,
      [profissionalId, salaoId]
    );
  }

  async findByPeriodo(startDate, endDate, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT c.*, p.nome as profissional_nome
       FROM comissoes c
       JOIN profissionais p ON p.id = c.profissional_id
       WHERE p.salao_id = $3 
       AND DATE(c.created_at) BETWEEN $1 AND $2
       ORDER BY c.created_at DESC`,
      [startDate, endDate, salaoId]
    );
  }

  async getTotalPorProfissional(profissionalId, startDate, endDate, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      `SELECT COALESCE(SUM(valor), 0) as total
       FROM comissoes c
       JOIN profissionais p ON p.id = c.profissional_id
       WHERE c.profissional_id = $1 
       AND p.salao_id = $4
       AND DATE(c.created_at) BETWEEN $2 AND $3`,
      [profissionalId, startDate, endDate, salaoId]
    );
  }

  async pendentes(salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT c.*, p.nome as profissional_nome
       FROM comissoes c
       JOIN profissionais p ON p.id = c.profissional_id
       WHERE p.salao_id = $1 AND c.pago = false
       ORDER BY c.created_at`,
      [salaoId]
    );
  }

  async marcarComoPago(id, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      `UPDATE comissoes SET pago = true, data_pagamento = CURRENT_TIMESTAMP
       WHERE id = $1 
       AND profissional_id IN (SELECT id FROM profissionais WHERE salao_id = $2)
       RETURNING *`,
      [id, salaoId]
    );
  }
}

module.exports = Comissao;
```
