const { query, queryOne } = require('../config/database');

class ComissaoPaga {
  static async create(data, salaoId) {
    return queryOne(`
      INSERT INTO comissoes_pagamentos (salao_id, profissional_id, valor, data_pagamento, observacoes, status)
      VALUES ($1, $2, $3, $4, $5, 'pago')
      RETURNING *
    `, [
      salaoId,
      data.profissional_id || data.profissionalId,
      data.valor,
      data.data_pagamento || data.dataPagamento || new Date().toISOString().split('T')[0],
      data.observacoes || null
    ]);
  }

  static async findById(id) {
    return queryOne(`
      SELECT cp.*, p.nome as profissional_nome
      FROM comissoes_pagamentos cp
      LEFT JOIN profissionais p ON cp.profissional_id = p.id
      WHERE cp.id = $1
    `, [id]);
  }

  static async getAll(filters = {}, salaoId) {
    const params = [salaoId];
    let idx = 2;
    let sql = `
      SELECT cp.*, p.nome as profissional_nome
      FROM comissoes_pagamentos cp
      LEFT JOIN profissionais p ON cp.profissional_id = p.id
      WHERE cp.salao_id = $1 AND cp.status = 'pago'
    `;
    if (filters.profissionalId) {
      sql += ` AND cp.profissional_id = $${idx++}`;
      params.push(filters.profissionalId);
    }
    if (filters.dataInicio && filters.dataFim) {
      sql += ` AND cp.data_pagamento BETWEEN $${idx++}::date AND $${idx++}::date`;
      params.push(filters.dataInicio, filters.dataFim);
    }
    if (filters.data) {
      sql += ` AND cp.data_pagamento = $${idx++}::date`;
      params.push(filters.data);
    }
    sql += ' ORDER BY cp.data_pagamento DESC, cp.created_at DESC';
    return query(sql, params);
  }

  static async getTotalPago(profissionalId = null, salaoId) {
    const params = [salaoId];
    let sql = `SELECT COALESCE(SUM(valor), 0) as total FROM comissoes_pagamentos WHERE salao_id = $1 AND status = 'pago'`;
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

module.exports = ComissaoPaga;
