const { query, withTransaction } = require('../config/database');

const BACKUP_TABLES = [
  'clientes', 'profissionais', 'servicos', 'produtos',
  'agendamentos', 'vendas', 'venda_itens', 'comissoes',
  'fechamentos', 'creditos_cliente', 'notificacoes'
];

// [P3-A2] Whitelist EXPLÍCITA de colunas permitidas por tabela durante restore.
// Qualquer coluna fora desta lista é descartada — impede SQL injection via JSON forjado
// com chaves maliciosas (ex.: "nome) VALUES (1); DROP TABLE x;--").
const ALLOWED_COLUMNS = {
  clientes: [
    'nome', 'email', 'telefone', 'cpf', 'data_nascimento', 'endereco', 'observacoes',
    'credito_disponivel', 'ativo', 'foto_url', 'created_at', 'updated_at',
    'push_token', 'salao_id'
  ],
  profissionais: [
    'nome', 'email', 'telefone', 'especialidade', 'comissao_percentual', 'comissao',
    'ativo', 'foto_url', 'created_at', 'updated_at', 'salao_id', 'app_ativo',
    'senha_hash', 'push_token', 'cpf', 'usuario_id'
  ],
  servicos: [
    'nome', 'descricao', 'preco', 'duracao_minutos', 'cor', 'ativo', 'categoria',
    'created_at', 'updated_at', 'salao_id'
  ],
  produtos: [
    'nome', 'descricao', 'preco_venda', 'preco_custo', 'quantidade_estoque',
    'categoria', 'marca', 'codigo_barras', 'ativo', 'foto_url',
    'created_at', 'updated_at', 'salao_id'
  ],
  agendamentos: [
    'cliente_id', 'profissional_id', 'auxiliar_id', 'servico_id', 'data_hora',
    'observacoes', 'valor', 'status', 'created_at', 'updated_at', 'salao_id',
    'duracao_minutos'
  ],
  vendas: [
    'cliente_id', 'profissional_id', 'tipo', 'status', 'valor_total', 'desconto',
    'valor_final', 'forma_pagamento', 'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  venda_itens: [
    'venda_id', 'produto_id', 'servico_id', 'tipo', 'item_id', 'quantidade',
    'preco_unitario', 'valor_total', 'subtotal', 'created_at'
  ],
  comissoes: [
    'profissional_id', 'agendamento_id', 'atendimento_id', 'venda_id', 'servico_id',
    'valor_servico', 'percentual', 'valor_comissao', 'pago', 'data_pagamento',
    'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  fechamentos: [
    'data_inicio', 'data_fim', 'tipo', 'status', 'total_servicos', 'total_produtos',
    'total_comissoes', 'total_liquido', 'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  creditos_cliente: [
    'cliente_id', 'tipo', 'valor', 'saldo_anterior', 'saldo_novo', 'observacoes',
    'created_at'
  ],
  notificacoes: [
    'salao_id', 'cliente_id', 'usuario_id', 'tipo', 'titulo', 'mensagem', 'lida',
    'created_at', 'updated_at'
  ],
};

// Regex de identificador SQL seguro — usado como segunda barreira além da whitelist.
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

function filterColumns(table, row) {
  const allowed = ALLOWED_COLUMNS[table] || [];
  const out = {};
  for (const k of Object.keys(row)) {
    if (!SAFE_IDENT.test(k)) continue;       // [P3-A2] rejeita identificadores não-padrão
    if (!allowed.includes(k)) continue;       // [P3-A2] rejeita colunas fora da whitelist
    out[k] = row[k];
  }
  return out;
}

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

          // [P3-A2] Validar nome da tabela contra a whitelist BACKUP_TABLES
          if (!BACKUP_TABLES.includes(table) || !SAFE_IDENT.test(table)) {
            throw new Error(`Tabela não permitida no restore: ${table}`);
          }
          let inserted = 0;
          for (const row of rows) {
            // [P3-A2] Filtrar colunas contra a whitelist por tabela
            const filteredRow = filterColumns(table, row);
            // Auto-gerados / inválidos
            delete filteredRow.id;

            if (table !== 'venda_itens') {
              filteredRow.salao_id = salaoId; // força tenant correto
            }

            const columns = Object.keys(filteredRow);
            if (columns.length === 0) continue; // nada válido restou
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
