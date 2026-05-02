const BaseModel = require('./BaseModel');
const { query, queryOne } = require('../config/database');

class Fechamento extends BaseModel {
  constructor() {
    super('fechamentos');
  }

  static async getAll(filters = {}, salaoId) {
    let sql = 'SELECT * FROM fechamentos WHERE 1=1';
    const params = [];
    let idx = 1;

    if (salaoId) {
      sql += ` AND salao_id = $${idx++}`;
      params.push(salaoId);
    }
    if (filters.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.dataInicio && filters.dataFim) {
      sql += ` AND data_inicio >= $${idx++}::date AND data_fim <= $${idx++}::date`;
      params.push(filters.dataInicio, filters.dataFim);
    }

    sql += ' ORDER BY data_inicio DESC, created_at DESC';
    return query(sql, params);
  }

  static async getByClienteEProfissional(clienteId, profissionalId, salaoId) {
    return queryOne(`
      SELECT f.* FROM fechamentos f
      WHERE f.salao_id = $1
        AND EXISTS (
          SELECT 1 FROM vendas v
          WHERE v.salao_id = f.salao_id
            AND v.cliente_id = $2
            AND ($3::int IS NULL OR v.profissional_id = $3)
            AND DATE(v.created_at) BETWEEN f.data_inicio AND f.data_fim
        )
      ORDER BY f.created_at DESC
      LIMIT 1
    `, [salaoId, clienteId, profissionalId || null]);
  }

  static async getResumo(salaoId, dataInicio, dataFim) {
    return queryOne(`
      SELECT
        COALESCE(SUM(total_vendas), 0) as total_vendas,
        COALESCE(SUM(total_servicos), 0) as total_servicos,
        COALESCE(SUM(total_produtos), 0) as total_produtos,
        COALESCE(SUM(total_comissoes), 0) as total_comissoes,
        COALESCE(SUM(total_liquido), 0) as total_liquido
      FROM fechamentos
      WHERE salao_id = $1 AND data_inicio >= $2::date AND data_fim <= $3::date
    `, [salaoId, dataInicio, dataFim]);
  }
}

module.exports = Fechamento;
