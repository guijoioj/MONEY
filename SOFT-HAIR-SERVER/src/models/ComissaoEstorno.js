const { query, queryOne } = require('../config/database');

class ComissaoEstorno {
  static async create(data, salaoId) {
    return queryOne(`
      INSERT INTO comissoes_pagamentos (salao_id, profissional_id, valor, data_pagamento, observacoes, motivo_estorno, status)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'estornado')
      RETURNING *
    `, [salaoId, data.profissional_id || data.profissionalId, data.valor, data.observacoes || null, data.motivo || null]);
  }

  static async findById(id) {
    return queryOne(`
      SELECT ce.*, p.nome as profissional_nome
      FROM comissoes_pagamentos ce
      LEFT JOIN profissionais p ON ce.profissional_id = p.id
      WHERE ce.id = $1 AND ce.status = 'estornado'
    `, [id]);
  }

  static async getAll(filters = {}, salaoId) {
    const params = [salaoId];
    let idx = 2;
    let sql = `
      SELECT ce.*, p.nome as profissional_nome
      FROM comissoes_pagamentos ce
      LEFT JOIN profissionais p ON ce.profissional_id = p.id
      WHERE ce.salao_id = $1 AND ce.status = 'estornado'
    `;
    if (filters.profissionalId) {
      sql += ` AND ce.profissional_id = $${idx++}`;
      params.push(filters.profissionalId);
    }
    if (filters.dataInicio && filters.dataFim) {
      sql += ` AND DATE(ce.created_at) BETWEEN $${idx++}::date AND $${idx++}::date`;
      params.push(filters.dataInicio, filters.dataFim);
    }
    sql += ' ORDER BY ce.created_at DESC';
    return query(sql, params);
  }

  static async getTotalEstornado(profissionalId = null, salaoId) {
    const params = [salaoId];
    let sql = `SELECT COALESCE(SUM(valor), 0) as total FROM comissoes_pagamentos WHERE salao_id = $1 AND status = 'estornado'`;
    if (profissionalId) {
      sql += ' AND profissional_id = $2';
      params.push(profissionalId);
    }
    const row = await queryOne(sql, params);
    return parseFloat(row?.total || 0);
  }

  static async delete(id, salaoId) {
    return query('DELETE FROM comissoes_pagamentos WHERE id = $1 AND salao_id = $2 RETURNING *', [id, salaoId]);
  }
}

module.exports = ComissaoEstorno;
