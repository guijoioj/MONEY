const { query, queryOne } = require('../config/database');

class ClienteHistorico {
  static async create(data, salaoId) {
    // [P5-A5] Usa tabela dedicada `historico_cliente` em vez de poluir `agendamentos`.
    // clienteId vem do PATH (rota), nunca do body.
    const clienteId = data.clienteId || data.cliente_id;
    return queryOne(`
      INSERT INTO historico_cliente (salao_id, cliente_id, tipo, descricao, entidade_id, data)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
      RETURNING *
    `, [salaoId, clienteId, data.tipo, data.descricao, data.entidadeId || null, data.data || null]);
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
