# src/models/Cliente.js

**Repository:** Server
**File:** `src/models/Cliente.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Cliente.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
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
/**
 * Model Cliente - Gerencia dados dos clientes do salão
 */

const BaseModel = require('./BaseModel');

class Cliente extends BaseModel {
  constructor() {
    super('clientes');
  }

  /**
   * Busca clientes por nome ou telefone
   */
  async buscarPorTermo(termo, limit = 20) {
    const sql = `
      SELECT * FROM clientes 
      WHERE (nome ILIKE $1 OR telefone ILIKE $1 OR email ILIKE $1) 
      AND ativo = true
      ORDER BY nome
      LIMIT $2
    `;
    const { query } = require('../config/database');
    return query(sql, [`%${termo}%`, limit]);
  }

  /**
   * Busca cliente por telefone
   */
  async findByTelefone(telefone) {
    const sql = `SELECT * FROM clientes WHERE telefone = $1 AND ativo = true`;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [telefone]);
  }

  /**
   * Busca clientes com aniversário no mês atual
   */
  async aniversariantesDoMes() {
    const sql = `
      SELECT * FROM clientes 
      WHERE EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND ativo = true
      ORDER BY EXTRACT(DAY FROM data_nascimento)
    `;
    const { query } = require('../config/database');
    return query(sql);
  }

  /**
   * Busca clientes por salão
   */
  async findBySalao(salaoId) {
    const sql = `SELECT * FROM clientes WHERE salao_id = $1 ORDER BY nome`;
    const { query } = require('../config/database');
    return query(sql, [salaoId]);
  }

  /**
   * Retorna resumo de fidelidade do cliente
   */
  async resumoFidelidade(clienteId) {
    const sql = `
      SELECT 
        COALESCE(COUNT(a.id), 0) as total_agendamentos,
        COALESCE(SUM(v.valor_total), 0) as total_gasto,
        MAX(a.data) as ultima_visita
      FROM clientes c
      LEFT JOIN agendamentos a ON a.cliente_id = c.id AND a.status = 'concluido'
      LEFT JOIN vendas v ON v.cliente_id = c.id AND v.status = 'finalizada'
      WHERE c.id = $1
      GROUP BY c.id
    `;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [clienteId]);
  }
}

module.exports = { Cliente };
```
