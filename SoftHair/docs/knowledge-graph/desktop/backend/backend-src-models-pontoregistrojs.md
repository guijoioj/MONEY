# backend/src/models/PontoRegistro.js

**Repository:** Desktop
**File:** `backend/src/models/PontoRegistro.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/PontoRegistro.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/profissionais|profissionais]]
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

class PontoRegistro {
  static async registrar(data) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO ponto_registros (id,"salonId","profissionalId",tipo,"atendimentoId",observacoes) VALUES (?,?,?,?,?,?)',
      [id, data.salonId, data.profissionalId, data.tipo, data.atendimentoId||null, data.observacoes||null]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM ponto_registros WHERE id=?', [id]);
  }

  static async getByProfissional(profissionalId, salonId, data) {
    let sql = 'SELECT * FROM ponto_registros WHERE "profissionalId"=? AND "salonId"=?';
    const params = [profissionalId, salonId];
    if (data) { sql += ' AND "timestamp"::date=?::date'; params.push(data); }
    sql += ' ORDER BY "timestamp" ASC';
    return query(sql, params);
  }

  static async getUltimoPonto(profissionalId, salonId) {
    return queryOne('SELECT * FROM ponto_registros WHERE "profissionalId"=? AND "salonId"=? ORDER BY "timestamp" DESC LIMIT 1', [profissionalId, salonId]);
  }

  static async getResumoHoje(profissionalId, salonId) {
    const registros = await this.getByProfissional(profissionalId, salonId, new Date().toISOString().split('T')[0]);
    const entrada = registros.find(r => r.tipo === 'entrada');
    const saida = registros.findLast(r => r.tipo === 'saida');
    const horasTrabalhadas = entrada && saida
      ? ((new Date(saida.timestamp) - new Date(entrada.timestamp)) / 3600000).toFixed(1)
      : null;
    return { registros, entrada, saida, horasTrabalhadas };
  }
}

module.exports = PontoRegistro;
```
