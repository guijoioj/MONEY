# src/models/Agendamento.js

**Repository:** Server
**File:** `src/models/Agendamento.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Agendamento.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
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
 * Model Agendamento - Gerencia dados dos agendamentos do salão
 */

const BaseModel = require('./BaseModel');
const { query, queryOne } = require('../config/database');

class Agendamento extends BaseModel {
  constructor() {
    super('agendamentos');
  }

  /**
   * Busca agendamentos por cliente
   */
  async findByCliente(clienteId, status = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        p.nome as profissional_nome,
        s.nome as servico_nome
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE a.cliente_id = $1
    `;
    const params = [clienteId];
    
    if (status) {
      sql += ` AND a.status = $2`;
      params.push(status);
    }
    
    sql += ` ORDER BY a.data_hora DESC`;
    return query(sql, params);
  }

  /**
   * Busca agendamentos por profissional
   */
  async findByProfissional(profissionalId, dataInicio = null, dataFim = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        s.nome as servico_nome, s.duracao_minutos
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE a.profissional_id = $1
    `;
    const params = [profissionalId];
    
    if (dataInicio && dataFim) {
      sql += ` AND DATE(a.data_hora) BETWEEN $2 AND $3`;
      params.push(dataInicio, dataFim);
    }
    
    sql += ` ORDER BY a.data_hora`;
    return query(sql, params);
  }

  /**
   * Busca agendamentos do dia
   */
  async doDia(data, salaoId = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        p.nome as profissional_nome,
        s.nome as servico_nome, s.duracao_minutos
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE DATE(a.data_hora) = $1
    `;
    const params = [data];
    
    if (salaoId) {
      sql += ` AND a.salao_id = $2`;
      params.push(salaoId);
    }
    
    sql += ` ORDER BY a.data_hora`;
    return query(sql, params);
  }

  /**
   * Busca agendamentos por período
   */
  async porPeriodo(dataInicio, dataFim, salaoId = null, status = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome,
        p.nome as profissional_nome,
        s.nome as servico_nome
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE DATE(a.data_hora) BETWEEN $1 AND $2
    `;
    const params = [dataInicio, dataFim];
    let paramCount = 2;
    
    if (salaoId) {
      sql += ` AND a.salao_id = $${++paramCount}`;
      params.push(salaoId);
    }
    
    if (status) {
      sql += ` AND a.status = $${++paramCount}`;
      params.push(status);
    }
    
    sql += ` ORDER BY a.data_hora`;
    return query(sql, params);
  }

  /**
   * Verifica conflito de horário
   */
  async verificarConflito(profissionalId, dataHora, duracao, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as total
      FROM agendamentos
      WHERE profissional_id = $1
      AND status NOT IN ('cancelado')
      AND (
        data_hora < $2::timestamp + INTERVAL '1 minute' * $3
        AND data_hora + INTERVAL '1 minute' * COALESCE(duracao_minutos, 30) > $2::timestamp
      )
    `;
    const params = [profissionalId, dataHora, duracao || 30];
    
    if (excludeId) {
      sql += ` AND id != $4`;
      params.push(excludeId);
    }
    
    const result = await queryOne(sql, params);
    return parseInt(result.total) > 0;
  }

  /**
   * Atualiza status do agendamento
   */
  async atualizarStatus(id, novoStatus, observacao = null) {
    const sql = `
      UPDATE agendamentos 
      SET status = $1, updated_at = CURRENT_TIMESTAMP, 
          observacoes = COALESCE($3, observacoes)
      WHERE id = $2 RETURNING *
    `;
    return queryOne(sql, [novoStatus, id, observacao]);
  }
}

module.exports = Agendamento;
```
