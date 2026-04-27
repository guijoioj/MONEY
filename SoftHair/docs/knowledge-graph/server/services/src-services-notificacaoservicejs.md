# src/services/NotificacaoService.js

**Repository:** Server
**File:** `src/services/NotificacaoService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/NotificacaoService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

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
const { query, queryOne } = require('../config/database');

class NotificacaoService {
  async listar(salaoId, filtros = {}) {
    try {
      let sql = 'SELECT * FROM notificacoes WHERE salao_id = $1';
      const params = [salaoId];
      let paramCount = 2;

      if (filtros.lida !== undefined) {
        sql += ` AND lida = $${paramCount++}`;
        params.push(filtros.lida === 'true' || filtros.lida === true);
      }
      if (filtros.tipo) {
        sql += ` AND tipo = $${paramCount++}`;
        params.push(filtros.tipo);
      }

      sql += ' ORDER BY created_at DESC';

      if (filtros.limit) {
        sql += ` LIMIT $${paramCount++}`;
        params.push(parseInt(filtros.limit) || 50);
      }

      const data = await query(sql, params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async criar(data, salaoId) {
    try {
      if (!data.tipo || !data.titulo || !data.mensagem) {
        return { success: false, error: 'tipo, titulo e mensagem são obrigatórios' };
      }

      const result = await queryOne(`
        INSERT INTO notificacoes (salao_id, tipo, titulo, mensagem, destinatario_id, destinatario_tipo)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [salaoId, data.tipo, data.titulo, data.mensagem,
          data.destinatario_id || null, data.destinatario_tipo || null]);

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async marcarComoLida(id, salaoId) {
    try {
      const result = await queryOne(
        'UPDATE notificacoes SET lida = true WHERE id = $1 AND salao_id = $2 RETURNING *',
        [id, salaoId]
      );
      if (!result) return { success: false, error: 'Notificação não encontrada' };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async marcarTodasComoLidas(salaoId) {
    try {
      await query('UPDATE notificacoes SET lida = true WHERE salao_id = $1 AND lida = false', [salaoId]);
      return { success: true, message: 'Todas as notificações marcadas como lidas' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deletar(id, salaoId) {
    try {
      const result = await queryOne(
        'DELETE FROM notificacoes WHERE id = $1 AND salao_id = $2 RETURNING id',
        [id, salaoId]
      );
      if (!result) return { success: false, error: 'Notificação não encontrada' };
      return { success: true, message: 'Notificação removida' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async contarNaoLidas(salaoId) {
    try {
      const result = await queryOne(
        'SELECT COUNT(*) as total FROM notificacoes WHERE salao_id = $1 AND lida = false',
        [salaoId]
      );
      return { success: true, data: { nao_lidas: parseInt(result.total) } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificacaoService;
```
