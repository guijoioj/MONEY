const { query, queryOne, withTransaction } = require('../config/database');

class FechamentoService {
  async listar(salaoId, filtros = {}) {
    try {
      let sql = 'SELECT * FROM fechamentos WHERE salao_id = $1';
      const params = [salaoId];
      let paramCount = 2;

      if (filtros.status) {
        sql += ` AND status = $${paramCount++}`;
        params.push(filtros.status);
      }
      if (filtros.tipo) {
        sql += ` AND tipo = $${paramCount++}`;
        params.push(filtros.tipo);
      }

      sql += ' ORDER BY data_fim DESC';
      const data = await query(sql, params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const data = await queryOne('SELECT * FROM fechamentos WHERE id = $1 AND salao_id = $2', [id, salaoId]);
      if (!data) return { success: false, error: 'Fechamento não encontrado' };
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async gerar(salaoId, dataInicio, dataFim, tipo = 'diario') {
    try {
      return await withTransaction(async (client) => {
        // Calcular totais do período
        const vendaResult = await client.query(`
          SELECT
            COALESCE(SUM(valor_final), 0) as total_vendas,
            COALESCE(SUM(CASE WHEN tipo = 'servico' THEN valor_final ELSE 0 END), 0) as total_servicos,
            COALESCE(SUM(CASE WHEN tipo = 'produto' THEN valor_final ELSE 0 END), 0) as total_produtos
          FROM vendas
          WHERE salao_id = $1 AND DATE(created_at) BETWEEN $2 AND $3 AND status != 'cancelada'
        `, [salaoId, dataInicio, dataFim]);

        const comissaoResult = await client.query(`
          SELECT COALESCE(SUM(valor_comissao), 0) as total_comissoes
          FROM comissoes
          WHERE salao_id = $1 AND DATE(created_at) BETWEEN $2 AND $3
        `, [salaoId, dataInicio, dataFim]);

        const totais = vendaResult.rows[0];
        const totalComissoes = parseFloat(comissaoResult.rows[0].total_comissoes);
        const totalLiquido = parseFloat(totais.total_vendas) - totalComissoes;

        // Criar fechamento
        const fechamento = await client.query(`
          INSERT INTO fechamentos (salao_id, data_inicio, data_fim, tipo, total_vendas, total_servicos,
            total_produtos, total_comissoes, total_liquido, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'fechado') RETURNING *
        `, [salaoId, dataInicio, dataFim, tipo,
            totais.total_vendas, totais.total_servicos, totais.total_produtos,
            totalComissoes, totalLiquido]);

        return { success: true, data: fechamento.rows[0] };
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async reabrir(id, salaoId) {
    try {
      const result = await queryOne(`
        UPDATE fechamentos SET status = 'aberto', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND salao_id = $2 RETURNING *
      `, [id, salaoId]);
      if (!result) return { success: false, error: 'Fechamento não encontrado' };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = FechamentoService;
