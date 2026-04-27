# backend/src/models/Notificacao.js

**Repository:** Desktop
**File:** `backend/src/models/Notificacao.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/Notificacao.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
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
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class Notificacao {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO notificacoes (id, tipo, titulo, mensagem, "clienteId", "salonId") VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.tipo, data.titulo, data.mensagem, data.clienteId||null, salonId]
    );
    return this.findById(id, salonId);
  }

  static async findById(id, salonId) {
    return queryOne('SELECT * FROM notificacoes WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = 'SELECT * FROM notificacoes WHERE "salonId" = ?';
    const params = [salonId];
    if (filters.lida !== undefined) {
      if (filters.lida === 'true' || filters.lida === true) { sql += ' AND lida = 1'; }
      else if (filters.lida === 'false' || filters.lida === false) { sql += ' AND lida = 0'; }
    }
    if (filters.tipo) { sql += ' AND tipo = ?'; params.push(filters.tipo); }
    sql += ' ORDER BY "createdAt" DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
    return query(sql, params);
  }

  static async marcarLida(id, salonId) {
    return queryRun('UPDATE notificacoes SET lida = 1 WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async marcarTodasLidas(salonId) {
    return queryRun('UPDATE notificacoes SET lida = 1 WHERE lida = 0 AND "salonId" = ?', [salonId]);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM notificacoes WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async deleteAllLidas(salonId) {
    return queryRun('DELETE FROM notificacoes WHERE lida = 1 AND "salonId" = ?', [salonId]);
  }

  static async countNaoLidas(salonId) {
    const row = await queryOne('SELECT COUNT(*) as count FROM notificacoes WHERE lida = 0 AND "salonId" = ?', [salonId]);
    return parseInt(row?.count || 0);
  }

  static async gerarNotificacoesClientesInativos(dias = 30, salonId) {
    const clientes = await query(`
      SELECT c.*,
        (SELECT MAX(a.data) FROM atendimentos a WHERE a."clienteId" = c.id AND a."salonId" = ?) as "ultimaVisita"
      FROM clientes c WHERE c."salonId" = ?
    `, [salonId, salonId]);

    const limite = new Date();
    limite.setDate(limite.getDate() - dias);
    const clientesInativos = clientes.filter(c => c.ultimaVisita && new Date(c.ultimaVisita) < limite);
    const notifications = [];

    for (const cliente of clientesInativos) {
      const existente = await queryOne(
        `SELECT id FROM notificacoes WHERE tipo = 'cliente_inativo' AND "clienteId" = ? AND "salonId" = ? AND lida = 0 AND "createdAt"::date = CURRENT_DATE`,
        [cliente.id, salonId]
      );
      if (!existente) {
        const dataUltima = new Date(cliente.ultimaVisita);
        const diasSemVisitar = Math.floor((new Date() - dataUltima) / (1000*60*60*24));
        const notif = await this.create({
          tipo: 'cliente_inativo',
          titulo: 'Cliente sem retorno',
          mensagem: `${cliente.nome} está há ${diasSemVisitar} dias sem visitar o salão`,
          clienteId: cliente.id
        }, salonId);
        notifications.push(notif);
      }
    }
    return notifications;
  }
}

module.exports = Notificacao;
```
