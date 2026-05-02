const { query, queryOne } = require('../config/database');

class ClienteHistorico {
  static async create(data, salaoId) {
    const observacoes = [data.tipo, data.descricao].filter(Boolean).join(': ');
    return queryOne(`
      INSERT INTO agendamentos (salao_id, cliente_id, data_hora, status, observacoes)
      VALUES ($1, $2, COALESCE($3::timestamp, NOW()), 'historico', $4)
      RETURNING *
    `, [salaoId, data.cliente_id || data.clienteId, data.data || null, observacoes || null]);
  }

  static async getByCliente(clienteId, filters = {}, salaoId) {
    const params = [clienteId, salaoId];
    let sql = `
      SELECT id, 'agendamento' as tipo, observacoes as descricao, data_hora as data, created_at
      FROM agendamentos
      WHERE cliente_id = $1 AND salao_id = $2
      UNION ALL
      SELECT id, 'venda' as tipo, observacoes as descricao, created_at as data, created_at
      FROM vendas
      WHERE cliente_id = $1 AND salao_id = $2
      ORDER BY data DESC
    `;
    if (filters.limit) {
      params.push(Math.min(parseInt(filters.limit, 10) || 50, 500));
      sql += ` LIMIT $${params.length}`;
    }
    return query(sql, params);
  }

  static async getResumo(clienteId, salaoId) {
    const resumo = await queryOne(`
      SELECT
        (SELECT COUNT(*) FROM atendimentos WHERE cliente_id = $1 AND salao_id = $2) as total_atendimentos,
        (SELECT COALESCE(SUM(valor_final), 0) FROM vendas WHERE cliente_id = $1 AND salao_id = $2) as total_gasto_produtos,
        (SELECT COALESCE(SUM(valor), 0) FROM atendimentos WHERE cliente_id = $1 AND salao_id = $2) as total_gasto_servicos
    `, [clienteId, salaoId]);

    const profissionaisFavoritos = await query(`
      SELECT p.nome, COUNT(*)::int as count
      FROM atendimentos a
      JOIN profissionais p ON p.id = a.profissional_id
      WHERE a.cliente_id = $1 AND a.salao_id = $2
      GROUP BY p.nome
      ORDER BY count DESC
      LIMIT 5
    `, [clienteId, salaoId]);

    return {
      totalAtendimentos: parseInt(resumo?.total_atendimentos || 0, 10),
      totalGastoServicos: parseFloat(resumo?.total_gasto_servicos || 0),
      totalGastoProdutos: parseFloat(resumo?.total_gasto_produtos || 0),
      profissionaisFavoritos,
      servicosFavoritos: [],
      produtosFavoritos: []
    };
  }

  static async delete() {
    return { rowCount: 0 };
  }

  static async deleteByCliente() {
    return { rowCount: 0 };
  }
}

module.exports = ClienteHistorico;
