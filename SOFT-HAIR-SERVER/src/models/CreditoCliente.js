const { query, queryOne } = require('../config/database');

class CreditoCliente {
  static async create(data, salaoId) {
    const clienteId = data.cliente_id || data.clienteId;
    const saldoAnterior = await this.getSaldo(clienteId, salaoId);
    const valor = Number(data.valor || 0);
    const tipo = data.tipo || 'credito';
    const saldoNovo = tipo === 'debito' ? saldoAnterior - valor : saldoAnterior + valor;

    return queryOne(`
      INSERT INTO creditos_cliente (cliente_id, salao_id, tipo, valor, saldo_anterior, saldo_novo, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [clienteId, salaoId, tipo, valor, saldoAnterior, saldoNovo, data.descricao || data.observacoes || null]);
  }

  static async findById(id) {
    return queryOne(`
      SELECT c.*, cl.nome as cliente_nome
      FROM creditos_cliente c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      WHERE c.id = $1
    `, [id]);
  }

  static async getByCliente(clienteId, salaoId) {
    return query(`
      SELECT * FROM creditos_cliente
      WHERE cliente_id = $1 AND ($2::int IS NULL OR salao_id = $2)
      ORDER BY created_at DESC
    `, [clienteId, salaoId || null]);
  }

  static async getSaldo(clienteId, salaoId) {
    const row = await queryOne(`
      SELECT COALESCE(
        SUM(CASE WHEN tipo = 'debito' THEN -valor ELSE valor END), 0
      ) as saldo
      FROM creditos_cliente
      WHERE cliente_id = $1 AND ($2::int IS NULL OR salao_id = $2)
    `, [clienteId, salaoId || null]);
    return parseFloat(row?.saldo || 0);
  }

  static async getAll(filters = {}, salaoId) {
    const params = [salaoId || null];
    let idx = 2;
    let sql = `
      SELECT c.*, cl.nome as cliente_nome
      FROM creditos_cliente c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      WHERE ($1::int IS NULL OR c.salao_id = $1)
    `;
    if (filters.clienteId) {
      sql += ` AND c.cliente_id = $${idx++}`;
      params.push(filters.clienteId);
    }
    if (filters.tipo) {
      sql += ` AND c.tipo = $${idx++}`;
      params.push(filters.tipo);
    }
    sql += ' ORDER BY c.created_at DESC';
    if (filters.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(Math.min(parseInt(filters.limit, 10) || 50, 500));
    }
    return query(sql, params);
  }

  static async getAllWithSaldo(salaoId) {
    const clientes = await query('SELECT id, nome, telefone FROM clientes WHERE salao_id = $1 ORDER BY nome', [salaoId]);
    for (const cliente of clientes) {
      cliente.saldo = await this.getSaldo(cliente.id, salaoId);
    }
    return clientes;
  }

  static async delete(id, salaoId) {
    return query('DELETE FROM creditos_cliente WHERE id = $1 AND salao_id = $2 RETURNING *', [id, salaoId]);
  }
}

module.exports = CreditoCliente;
