const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

// ─── Whitelist de tabelas permitidas para sync ───
const ALLOWED_TABLES = [
  'clientes', 'profissionais', 'servicos', 'produtos',
  'agendamentos', 'vendas', 'comissoes', 'atendimentos',
  'fechamentos', 'creditos_cliente', 'notificacoes'
];

// Colunas permitidas por tabela (prevenir SQL injection)
const TABLE_COLUMNS = {
  clientes: ['nome', 'telefone', 'email', 'cpf', 'endereco', 'data_nascimento', 'observacoes', 'foto_url', 'credito_disponivel', 'ativo'],
  profissionais: ['nome', 'telefone', 'email', 'cpf', 'especialidade', 'comissao_percentual', 'foto_url', 'ativo'],
  servicos: ['nome', 'descricao', 'preco', 'duracao_minutos', 'comissao_percentual', 'cor', 'ativo'],
  produtos: ['nome', 'descricao', 'preco_custo', 'preco_venda', 'quantidade_estoque', 'quantidade_minima', 'categoria', 'codigo_barras', 'ativo'],
  agendamentos: ['cliente_id', 'profissional_id', 'servico_id', 'data_hora', 'duracao_minutos', 'status', 'observacoes', 'valor'],
  vendas: ['cliente_id', 'profissional_id', 'tipo', 'status', 'valor_total', 'desconto', 'valor_final', 'forma_pagamento', 'observacoes'],
  comissoes: ['profissional_id', 'venda_id', 'valor_total', 'percentual', 'valor_comissao', 'pago', 'data_pagamento'],
  atendimentos: ['cliente_id', 'profissional_id', 'servico_id', 'agendamento_id', 'valor', 'status', 'observacoes'],
  fechamentos: ['data_inicio', 'data_fim', 'tipo', 'total_vendas', 'total_servicos', 'total_produtos', 'total_comissoes', 'total_liquido', 'observacoes', 'status'],
  creditos_cliente: ['cliente_id', 'tipo', 'valor', 'saldo_anterior', 'saldo_novo', 'observacoes'],
  notificacoes: ['tipo', 'titulo', 'mensagem', 'destinatario_id', 'destinatario_tipo', 'lida']
};

/**
 * Valida se o nome da tabela é permitido
 */
function isAllowedTable(table) {
  return ALLOWED_TABLES.includes(table);
}

/**
 * Filtra dados para conter apenas colunas permitidas da tabela
 */
function sanitizeData(table, data) {
  const allowedCols = TABLE_COLUMNS[table];
  if (!allowedCols) return {};

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedCols.includes(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ─── GET /changes — Obter mudanças desde a última sincronização ───
router.get('/changes', authMiddleware, async (req, res) => {
  try {
    const { since, tables } = req.query;
    const salaoId = req.salaoId;

    if (!since) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "since" é obrigatório'
      });
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "since" deve ser uma data válida (ISO 8601)'
      });
    }

    // Validar tabelas contra whitelist
    const requestedTables = tables
      ? tables.split(',').filter(t => isAllowedTable(t.trim()))
      : ALLOWED_TABLES;

    const changes = {};

    for (const table of requestedTables) {
      const rows = await query(
        `SELECT * FROM ${table} WHERE salao_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
        [salaoId, sinceDate]
      );
      if (rows.length > 0) {
        changes[table] = rows;
      }
    }

    res.json({
      success: true,
      data: changes,
      syncTimestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SYNC] Erro ao obter mudanças:', error);
    res.status(500).json({ success: false, error: 'Erro ao obter mudanças' });
  }
});

// ─── POST /push — Enviar mudanças do cliente para o servidor ───
router.post('/push', authMiddleware, async (req, res) => {
  try {
    const { changes } = req.body;
    const salaoId = req.salaoId;

    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        error: '"changes" deve ser um array'
      });
    }

    if (changes.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Máximo de 500 mudanças por requisição'
      });
    }

    const ALLOWED_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE'];

    // Processar todas as mudanças dentro de uma transaction
    const results = await withTransaction(async (client) => {
      const txResults = [];

      for (const change of changes) {
        const { table, operation, data } = change;

        // Validações
        if (!isAllowedTable(table)) {
          txResults.push({ table, operation, success: false, error: `Tabela "${table}" não permitida` });
          continue;
        }

        if (!ALLOWED_OPERATIONS.includes(operation)) {
          txResults.push({ table, operation, success: false, error: `Operação "${operation}" não permitida` });
          continue;
        }

        if (!data || typeof data !== 'object') {
          txResults.push({ table, operation, success: false, error: 'Dados inválidos' });
          continue;
        }

        try {
          let result;
          const sanitized = sanitizeData(table, data);

          switch (operation) {
            case 'INSERT': {
              const columns = Object.keys(sanitized);
              if (columns.length === 0) {
                txResults.push({ table, operation, success: false, error: 'Nenhuma coluna válida' });
                continue;
              }
              const values = Object.values(sanitized);
              const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');

              const res = await client.query(
                `INSERT INTO ${table} (${columns.join(', ')}, salao_id) VALUES (${placeholders}, $1) RETURNING *`,
                [salaoId, ...values]
              );
              result = res.rows[0];
              break;
            }

            case 'UPDATE': {
              const updateId = data.id;
              if (!updateId) {
                txResults.push({ table, operation, success: false, error: 'ID é obrigatório para UPDATE' });
                continue;
              }
              const columns = Object.keys(sanitized);
              if (columns.length === 0) {
                txResults.push({ table, operation, success: false, error: 'Nenhuma coluna válida para atualizar' });
                continue;
              }
              const values = Object.values(sanitized);
              const setClause = columns.map((k, i) => `${k} = $${i + 3}`).join(', ');

              const res = await client.query(
                `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND salao_id = $1 RETURNING *`,
                [salaoId, updateId, ...values]
              );
              result = res.rows[0];
              break;
            }

            case 'DELETE': {
              if (!data.id) {
                txResults.push({ table, operation, success: false, error: 'ID é obrigatório para DELETE' });
                continue;
              }
              const res = await client.query(
                `DELETE FROM ${table} WHERE id = $2 AND salao_id = $1 RETURNING id`,
                [salaoId, data.id]
              );
              result = res.rows[0];
              break;
            }
          }

          txResults.push({ table, operation, success: true, data: result });
        } catch (error) {
          // [P2-M1] Sanitizar mensagem em prod (mensagens Postgres podem vazar schema).
          console.error('[SYNC] erro em mudança:', table, operation, error.message);
          const safe = process.env.NODE_ENV === 'production' ? 'Erro ao processar mudança' : error.message;
          txResults.push({ table, operation, success: false, error: safe });
        }
      }

      return txResults;
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[SYNC] Erro ao processar mudanças:', error);
    res.status(500).json({ success: false, error: 'Erro ao processar mudanças' });
  }
});

// ─── GET /last-sync — Timestamp da última sincronização ───
router.get('/last-sync', authMiddleware, async (req, res) => {
  try {
    const salaoId = req.salaoId;

    const result = await query(
      'SELECT MAX(sync_timestamp) as last_sync FROM sync_log WHERE salao_id = $1',
      [salaoId]
    );

    res.json({
      success: true,
      data: { lastSync: result[0]?.last_sync || null }
    });
  } catch (error) {
    console.error('[SYNC] Erro ao obter última sincronização:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// ─── POST /reset — Resetar sync para re-sync completo ───
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    const salaoId = req.salaoId;

    await query(
      'UPDATE sync_log SET client_synced = false WHERE salao_id = $1',
      [salaoId]
    );

    res.json({
      success: true,
      message: 'Sincronização resetada. Re-sync completo necessário.'
    });
  } catch (error) {
    console.error('[SYNC] Erro ao resetar sincronização:', error);
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
