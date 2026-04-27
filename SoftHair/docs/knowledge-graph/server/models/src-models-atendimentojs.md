# src/models/Atendimento.js

**Repository:** Server
**File:** `src/models/Atendimento.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Atendimento.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
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

class Atendimento extends BaseModel {
  constructor() {
    super('atendimentos');
  }

  async findByCliente(clienteId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT a.* 
       FROM atendimentos a
       JOIN agendamentos ag ON ag.id = a.agendamento_id
       WHERE ag.cliente_id = $1 AND ag.salao_id = $2
       ORDER BY a.created_at DESC`,
      [clienteId, salaoId]
    );
  }

  async findByProfissional(profissionalId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT a.* 
       FROM atendimentos a
       JOIN agendamentos ag ON ag.id = a.agendamento_id
       WHERE ag.profissional_id = $1 AND ag.salao_id = $2
       ORDER BY a.created_at DESC`,
      [profissionalId, salaoId]
    );
  }

  async findByDate(date, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT a.* 
       FROM atendimentos a
       JOIN agendamentos ag ON ag.id = a.agendamento_id
       WHERE DATE(ag.data_hora) = $1 AND ag.salao_id = $2
       ORDER BY ag.data_hora`,
      [date, salaoId]
    );
  }

  async getEstatisticasPorPeriodo(startDate, endDate, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(`
      SELECT 
        COUNT(*) as total_atendimentos,
        COALESCE(SUM(valor_servico), 0) as total_valor_servico,
        COALESCE(SUM(valor_produtos), 0) as total_valor_produtos
      FROM atendimentos a
      JOIN agendamentos ag ON ag.id = a.agendamento_id
      WHERE ag.salao_id = $3 AND DATE(a.created_at) BETWEEN $1 AND $2
    `, [startDate, endDate, salaoId]);
  }
}

module.exports = Atendimento;
```
