# src/services/BackupService.js

**Repository:** Server
**File:** `src/services/BackupService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/BackupService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/servicos|servicos]]
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
const { query, withTransaction } = require('../config/database');

const BACKUP_TABLES = [
  'clientes', 'profissionais', 'servicos', 'produtos',
  'agendamentos', 'vendas', 'venda_itens', 'comissoes',
  'fechamentos', 'creditos_cliente', 'notificacoes'
];

class BackupService {
  /**
   * Gera um backup completo dos dados do salão (JSON)
   */
  async gerarBackup(salaoId) {
    try {
      const backup = {
        metadata: {
          salao_id: salaoId,
          created_at: new Date().toISOString(),
          version: '1.0.0',
          tables: BACKUP_TABLES
        },
        data: {}
      };

      for (const table of BACKUP_TABLES) {
        // venda_itens não tem salao_id direto, precisa join
        if (table === 'venda_itens') {
          backup.data[table] = await query(`
            SELECT vi.* FROM venda_itens vi
            JOIN vendas v ON v.id = vi.venda_id
            WHERE v.salao_id = $1
          `, [salaoId]);
        } else {
          backup.data[table] = await query(
            `SELECT * FROM ${table} WHERE salao_id = $1 ORDER BY id`,
            [salaoId]
          );
        }
      }

      return { success: true, data: backup };
    } catch (error) {
      console.error('[BackupService] Erro ao gerar backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restaura backup (com validação e transação)
   */
  async restaurarBackup(salaoId, backupData) {
    try {
      if (!backupData || !backupData.metadata || !backupData.data) {
        return { success: false, error: 'Formato de backup inválido' };
      }

      return await withTransaction(async (client) => {
        const stats = {};

        // Limpar tabelas na ordem correta (respeitar foreign keys)
        const deleteOrder = [
          'notificacoes', 'creditos_cliente', 'comissoes', 'venda_itens',
          'fechamentos', 'vendas', 'agendamentos', 'produtos', 'servicos',
          'profissionais', 'clientes'
        ];

        for (const table of deleteOrder) {
          if (table === 'venda_itens') {
            await client.query(`
              DELETE FROM venda_itens WHERE venda_id IN (
                SELECT id FROM vendas WHERE salao_id = $1
              )`, [salaoId]);
          } else {
            await client.query(`DELETE FROM ${table} WHERE salao_id = $1`, [salaoId]);
          }
        }

        // Inserir dados na ordem correta (dependências primeiro)
        const insertOrder = [
          'clientes', 'profissionais', 'servicos', 'produtos',
          'agendamentos', 'vendas', 'venda_itens', 'comissoes',
          'fechamentos', 'creditos_cliente', 'notificacoes'
        ];

        for (const table of insertOrder) {
          const rows = backupData.data[table];
          if (!rows || rows.length === 0) {
            stats[table] = 0;
            continue;
          }

          let inserted = 0;
          for (const row of rows) {
            const filteredRow = { ...row };
            // Remover campos que serão auto-gerados
            delete filteredRow.id;

            if (table !== 'venda_itens') {
              filteredRow.salao_id = salaoId;
            }

            const columns = Object.keys(filteredRow);
            const values = Object.values(filteredRow);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            await client.query(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
            inserted++;
          }
          stats[table] = inserted;
        }

        return { success: true, data: stats, message: 'Backup restaurado com sucesso' };
      });
    } catch (error) {
      console.error('[BackupService] Erro ao restaurar:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BackupService;
```
