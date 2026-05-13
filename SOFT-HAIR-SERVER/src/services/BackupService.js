const { query, withTransaction } = require('../config/database');
const crypto = require('crypto');

// [P5-A2] Criptografia de backup com AES-256-GCM
// Chave: BACKUP_ENCRYPTION_KEY (hex 64 chars = 32 bytes) ou fallback para ENCRYPTION_KEY.
// Quando indisponível, backup retorna em plaintext mas com aviso.
function _getBackupKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, 'hex');
    if (buf.length !== 32) return null;
    return buf;
  } catch {
    return null;
  }
}

function encryptBackupPayload(jsonString) {
  const key = _getBackupKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
    version: 'v1',
    algo: 'aes-256-gcm',
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    payload: encrypted.toString('base64'),
  };
}

function decryptBackupPayload(envelope) {
  if (!envelope || !envelope.encrypted) return null;
  const key = _getBackupKey();
  if (!key) throw new Error('BACKUP_ENCRYPTION_KEY ausente para descriptografar');
  if (envelope.algo !== 'aes-256-gcm') throw new Error('Algoritmo de backup desconhecido');
  const iv = Buffer.from(envelope.iv, 'hex');
  const tag = Buffer.from(envelope.tag, 'hex');
  const payload = Buffer.from(envelope.payload, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// [P6-M5] BACKUP_TABLES expandido — cobre tabelas tenant-scoped relevantes para DR.
// audit_log INTENCIONALMENTE excluído — é trilha forense imutável (P6-C2 hash chain).
// Restore não deve recriar audit_log; backup separado/imutável fica fora deste fluxo.
const BACKUP_TABLES = [
  'clientes', 'profissionais', 'servicos', 'produtos',
  'agendamentos', 'vendas', 'venda_itens', 'comissoes',
  'fechamentos', 'creditos_cliente', 'notificacoes',
  // P6-M5 additions
  'atendimentos', 'historico_cliente', 'registros_ponto',
  'despesas', 'bloqueios_horario', 'metas_profissional',
  'pontos_fidelidade', 'configuracoes', 'produtos_utilizados',
  'pedidos_agendamento', 'pedidos_loja', 'pedido_loja_itens',
  'comissoes_pagamentos'
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
    // [P4-B8] `senha_hash` removido do whitelist de restore — backup adulterado offline
    // poderia injetar hash controlado pelo atacante e permitir login como qualquer
    // profissional. Recuperação de senha deve ocorrer pelo fluxo dedicado.
    'nome', 'email', 'telefone', 'especialidade', 'comissao_percentual', 'comissao',
    'ativo', 'foto_url', 'created_at', 'updated_at', 'salao_id', 'app_ativo',
    'push_token', 'cpf', 'usuario_id'
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
    // [P6-C1] REMOVIDOS: 'status', 'valor_final' — restore não pode marcar venda como
    // finalizada nem alterar valor_final (que afeta comissões/fechamento). Force
    // status='pendente' e valor_final será re-derivado de valor_total - desconto.
    'cliente_id', 'profissional_id', 'tipo', 'valor_total', 'desconto',
    'forma_pagamento', 'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  venda_itens: [
    'venda_id', 'produto_id', 'servico_id', 'tipo', 'item_id', 'quantidade',
    'preco_unitario', 'valor_total', 'subtotal', 'created_at'
  ],
  comissoes: [
    // [P6-C1] REMOVIDOS: 'pago', 'data_pagamento', 'valor_comissao' — restore não pode
    // marcar comissões como pagas nem alterar valor (burlaria P5-C3/P5-C4). Restore force-
    // resetam pago=false e valor_comissao deve ser re-derivado de servico+percentual.
    'profissional_id', 'agendamento_id', 'atendimento_id', 'venda_id', 'servico_id',
    'valor_servico', 'percentual',
    'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  fechamentos: [
    // [P6-C1] REMOVIDO: 'status' — restore não pode reabrir fechamento via backup
    // adulterado (burlaria P5-C5). Force status='aberto' no insert.
    'data_inicio', 'data_fim', 'tipo', 'total_servicos', 'total_produtos',
    'total_comissoes', 'total_liquido', 'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  creditos_cliente: [
    // [P6-C1] REMOVIDOS: 'saldo_anterior', 'saldo_novo' — restore só re-cria movimentações
    // (tipo + valor); saldos finais derivam de re-soma. Backup adulterado não pode
    // injetar saldo arbitrário.
    'cliente_id', 'tipo', 'valor', 'observacoes',
    'created_at'
  ],
  notificacoes: [
    'salao_id', 'cliente_id', 'usuario_id', 'tipo', 'titulo', 'mensagem', 'lida',
    'created_at', 'updated_at'
  ],
  // [P6-M5] whitelists para tabelas adicionais
  atendimentos: [
    'agendamento_id', 'cliente_id', 'profissional_id', 'servico_id',
    'data_atendimento', 'status', 'observacoes', 'valor', 'created_at', 'updated_at', 'salao_id'
  ],
  historico_cliente: [
    'cliente_id', 'tipo', 'descricao', 'entidade_id', 'data', 'created_at', 'salao_id'
  ],
  registros_ponto: [
    'profissional_id', 'tipo', 'created_at', 'salao_id'
  ],
  despesas: [
    'descricao', 'valor', 'categoria', 'data', 'recorrente', 'observacoes', 'created_at', 'salao_id'
  ],
  bloqueios_horario: [
    'profissional_id', 'data_inicio', 'data_fim', 'motivo', 'dia_inteiro', 'created_at', 'salao_id'
  ],
  metas_profissional: [
    'profissional_id', 'mes', 'ano', 'meta_valor', 'meta_atendimentos', 'salao_id'
  ],
  pontos_fidelidade: [
    'cliente_id', 'pontos', 'tipo', 'descricao', 'referencia_id', 'referencia_tipo',
    'created_at', 'salao_id'
  ],
  configuracoes: [
    'chave', 'valor', 'created_at', 'updated_at', 'salao_id'
  ],
  produtos_utilizados: [
    'profissional_id', 'agendamento_id', 'produto_id', 'cliente_id', 'cliente_nome',
    'marca', 'coloracao', 'quantidade', 'observacoes', 'created_at', 'salao_id'
  ],
  pedidos_agendamento: [
    'cliente_app_id', 'servico_id', 'profissional_id', 'data_desejada',
    'horario_desejado', 'horario_alternativo', 'observacoes', 'status',
    'agendamento_id', 'atendido_por', 'motivo_rejeicao',
    'created_at', 'updated_at', 'salao_id'
  ],
  pedidos_loja: [
    'cliente_app_id', 'status', 'total', 'endereco_entrega', 'forma_pagamento',
    'observacoes', 'created_at', 'updated_at', 'salao_id'
  ],
  pedido_loja_itens: [
    'pedido_id', 'produto_id', 'quantidade', 'preco_unitario', 'subtotal'
  ],
  comissoes_pagamentos: [
    // [P6-C1 spirit] NÃO inclui 'status' editável — força default no insert
    'profissional_id', 'valor', 'data_pagamento', 'observacoes',
    'motivo_estorno', 'created_at', 'salao_id'
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
        // venda_itens / pedido_loja_itens não têm salao_id direto, precisam join
        if (table === 'venda_itens') {
          backup.data[table] = await query(`
            SELECT vi.* FROM venda_itens vi
            JOIN vendas v ON v.id = vi.venda_id
            WHERE v.salao_id = $1
          `, [salaoId]);
        } else if (table === 'pedido_loja_itens') {
          backup.data[table] = await query(`
            SELECT pli.* FROM pedido_loja_itens pli
            JOIN pedidos_loja pl ON pl.id = pli.pedido_id
            WHERE pl.salao_id = $1
          `, [salaoId]);
        } else {
          backup.data[table] = await query(
            `SELECT * FROM ${table} WHERE salao_id = $1 ORDER BY id`,
            [salaoId]
          );
        }
      }

      // [P5-A2] Criptografar se chave disponível. Mantém metadata clara mas envelopa data.
      // [P6-M1] Em produção, FALHA explícita quando chave ausente (fail-fast) — não
      // mais retorna silenciosamente plaintext. Em dev, ainda permite com warning.
      const envelope = encryptBackupPayload(JSON.stringify(backup.data));
      if (envelope) {
        backup.encrypted_data = envelope;
        backup.metadata.encrypted = true;
        delete backup.data;
      } else if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          error: 'BACKUP_ENCRYPTION_KEY ausente — backup em plaintext bloqueado em produção'
        };
      } else {
        backup.metadata.encrypted = false;
        backup.metadata.warning = 'BACKUP_ENCRYPTION_KEY não configurada — backup em plaintext (apenas dev)';
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
      if (!backupData || !backupData.metadata) {
        return { success: false, error: 'Formato de backup inválido' };
      }
      // [P5-A2] Descriptografar payload se necessário
      if (backupData.encrypted_data && !backupData.data) {
        try {
          backupData.data = decryptBackupPayload(backupData.encrypted_data);
        } catch (err) {
          return { success: false, error: `Falha ao descriptografar backup: ${err.message}` };
        }
      }
      if (!backupData.data) {
        return { success: false, error: 'Formato de backup inválido (payload ausente)' };
      }

      return await withTransaction(async (client) => {
        const stats = {};

        // Limpar tabelas na ordem correta (respeitar foreign keys)
        // [P6-M5] Inclui tabelas novas — filhas antes das mães
        const deleteOrder = [
          'pedido_loja_itens', 'pedidos_loja', 'pedidos_agendamento',
          'produtos_utilizados', 'pontos_fidelidade', 'metas_profissional',
          'bloqueios_horario', 'despesas', 'registros_ponto',
          'historico_cliente', 'atendimentos', 'configuracoes',
          'comissoes_pagamentos',
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
          } else if (table === 'pedido_loja_itens') {
            await client.query(`
              DELETE FROM pedido_loja_itens WHERE pedido_id IN (
                SELECT id FROM pedidos_loja WHERE salao_id = $1
              )`, [salaoId]);
          } else {
            await client.query(`DELETE FROM ${table} WHERE salao_id = $1`, [salaoId]);
          }
        }

        // Inserir dados na ordem correta (dependências primeiro)
        // [P6-M5] Inclui tabelas novas — mães antes das filhas
        const insertOrder = [
          'clientes', 'profissionais', 'servicos', 'produtos',
          'agendamentos', 'vendas', 'venda_itens', 'comissoes',
          'fechamentos', 'creditos_cliente', 'notificacoes',
          'atendimentos', 'historico_cliente', 'registros_ponto',
          'despesas', 'bloqueios_horario', 'metas_profissional',
          'pontos_fidelidade', 'configuracoes', 'produtos_utilizados',
          'pedidos_agendamento', 'pedidos_loja', 'pedido_loja_itens',
          'comissoes_pagamentos'
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

            // [P6-M5] tabelas sem coluna salao_id direta (filhas com FK)
            const TABLES_WITHOUT_SALAO_ID = ['venda_itens', 'pedido_loja_itens'];
            if (!TABLES_WITHOUT_SALAO_ID.includes(table)) {
              filteredRow.salao_id = salaoId; // força tenant correto
            }

            // [P6-C1] Force-reset campos financeiros sensíveis no restore.
            // Mesmo que estejam no whitelist por engano, sobrescreve aqui.
            if (table === 'comissoes') {
              filteredRow.pago = false;
              filteredRow.data_pagamento = null;
            }
            if (table === 'vendas') {
              filteredRow.status = 'pendente';
              // valor_final será recalculado por trigger/aplicação posterior.
              // Se desconto não veio, força 0; valor_final = valor_total - desconto.
              const vt = parseFloat(filteredRow.valor_total) || 0;
              const desc = parseFloat(filteredRow.desconto) || 0;
              filteredRow.valor_final = Math.max(0, vt - desc);
            }
            if (table === 'fechamentos') {
              filteredRow.status = 'aberto';
            }
            if (table === 'creditos_cliente') {
              // saldo_anterior/saldo_novo serão recalculados via append-only.
              // Aqui apenas garantimos que não vieram do backup.
              delete filteredRow.saldo_anterior;
              delete filteredRow.saldo_novo;
            }

            // [P5-M7] Validar FKs cross-tenant em notificacoes: descarta linha se ref não bate.
            if (table === 'notificacoes') {
              if (filteredRow.cliente_id) {
                const r = await client.query(
                  'SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2',
                  [filteredRow.cliente_id, salaoId]
                );
                if (!r.rows.length) continue; // descarta linha
              }
              if (filteredRow.usuario_id) {
                const r = await client.query(
                  'SELECT 1 FROM usuarios WHERE id = $1 AND salao_id = $2',
                  [filteredRow.usuario_id, salaoId]
                );
                if (!r.rows.length) continue;
              }
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
