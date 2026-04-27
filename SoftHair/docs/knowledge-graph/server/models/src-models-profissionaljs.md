# src/models/Profissional.js

**Repository:** Server
**File:** `src/models/Profissional.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/Profissional.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
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
/**
 * Model Profissional - Gerencia dados dos profissionais do salão
 */

const BaseModel = require('./BaseModel');

class Profissional extends BaseModel {
  constructor() {
    super('profissionais');
  }

  /**
   * Busca profissionais ativos por salão
   */
  async buscarAtivosPorSalao(salaoId) {
    const sql = `
      SELECT * FROM profissionais 
      WHERE salao_id = $1 AND ativo = true 
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId]);
  }

  /**
   * Busca profissional por usuário vinculado
   */
  async findByUsuario(usuarioId) {
    const sql = `SELECT * FROM profissionais WHERE usuario_id = $1`;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [usuarioId]);
  }

  /**
   * Busca profissionais por especialidade
   */
  async findByEspecialidade(especialidade) {
    const sql = `
      SELECT * FROM profissionais 
      WHERE ativo = true AND especialidades ILIKE $1
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [`%${especialidade}%`]);
  }

  /**
   * Busca profissionais disponíveis para agendamento
   */
  async disponiveisParaData(data, horaInicio, horaFim) {
    const sql = `
      SELECT p.* FROM profissionais p
      WHERE p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.profissional_id = p.id
        AND a.data_agendamento = $1
        AND a.hora_agendamento < $3
        AND (a.hora_agendamento + INTERVAL '1 minute' * a.duracao) > $2
        AND a.status NOT IN ('cancelado', 'nao_compareceu')
      )
      ORDER BY p.nome
    `;
    const { query } = require('../config/database');
    return query(sql, [data, horaInicio, horaFim]);
  }

  /**
   * Retorna comissões do período
   */
  async comissoesPeriodo(profissionalId, dataInicio, dataFim) {
    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'servico' THEN valor ELSE 0 END), 0) as total_servicos,
        COALESCE(SUM(CASE WHEN tipo = 'produto' THEN valor ELSE 0 END), 0) as total_produtos,
        COALESCE(SUM(valor), 0) as total_comissoes
      FROM comissoes
      WHERE profissional_id = $1
      AND data BETWEEN $2 AND $3
      AND status = 'pendente'
    `;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [profissionalId, dataInicio, dataFim]);
  }
}

module.exports = { Profissional };
```
