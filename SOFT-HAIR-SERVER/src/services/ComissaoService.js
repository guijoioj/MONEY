const { query, queryOne, withTransaction } = require('../config/database');

class ComissaoService {
  async listar(salaoId, filtros = {}) {
    try {
      let sql = `
        SELECT co.*, p.nome as profissional_nome, v.tipo as venda_tipo
        FROM comissoes co
        LEFT JOIN profissionais p ON p.id = co.profissional_id
        LEFT JOIN vendas v ON v.id = co.venda_id
        WHERE co.salao_id = $1
      `;
      const params = [salaoId];
      let paramCount = 2;

      if (filtros.profissional_id) {
        sql += ` AND co.profissional_id = $${paramCount++}`;
        params.push(filtros.profissional_id);
      }
      if (filtros.pago !== undefined) {
        sql += ` AND co.pago = $${paramCount++}`;
        params.push(filtros.pago === 'true' || filtros.pago === true);
      }
      if (filtros.data_inicio && filtros.data_fim) {
        sql += ` AND DATE(co.created_at) BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(filtros.data_inicio, filtros.data_fim);
      }

      // [P5-B9] LIMIT configurável via env (default 200, máx 2000)
      const lim = Math.min(parseInt(process.env.COMISSOES_LIST_LIMIT || '200', 10) || 200, 2000);
      sql += ` ORDER BY co.created_at DESC LIMIT ${lim}`;
      const data = await query(sql, params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const data = await queryOne(`
        SELECT co.*, p.nome as profissional_nome
        FROM comissoes co
        LEFT JOIN profissionais p ON p.id = co.profissional_id
        WHERE co.id = $1 AND co.salao_id = $2
      `, [id, salaoId]);
      if (!data) return { success: false, error: 'Comissão não encontrada' };
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async criar(data, salaoId) {
    try {
      const result = await queryOne(`
        INSERT INTO comissoes (profissional_id, venda_id, valor_total, percentual, valor_comissao, salao_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [data.profissional_id, data.venda_id, data.valor_total, data.percentual,
          data.valor_comissao, salaoId]);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async marcarComoPaga(id, salaoId) {
    try {
      const result = await queryOne(`
        UPDATE comissoes SET pago = true, data_pagamento = CURRENT_DATE
        WHERE id = $1 AND salao_id = $2 RETURNING *
      `, [id, salaoId]);
      if (!result) return { success: false, error: 'Comissão não encontrada' };
      return { success: true, data: result, message: 'Comissão marcada como paga' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async resumoPorProfissional(salaoId, profissionalId, dataInicio, dataFim) {
    try {
      const data = await queryOne(`
        SELECT
          COUNT(*) as total_comissoes,
          COALESCE(SUM(valor_comissao), 0) as total_valor,
          COALESCE(SUM(CASE WHEN pago THEN valor_comissao ELSE 0 END), 0) as total_pago,
          COALESCE(SUM(CASE WHEN NOT pago THEN valor_comissao ELSE 0 END), 0) as total_pendente
        FROM comissoes
        WHERE salao_id = $1 AND profissional_id = $2
        AND DATE(created_at) BETWEEN $3 AND $4
      `, [salaoId, profissionalId, dataInicio, dataFim]);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ComissaoService;
