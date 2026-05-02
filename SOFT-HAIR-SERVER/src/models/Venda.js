const BaseModel = require('./BaseModel');

class Venda extends BaseModel {
  constructor() {
    super('vendas');
  }

  async findByPeriod(startDate, endDate, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT * FROM vendas 
       WHERE salao_id = $1 
       AND DATE(created_at) BETWEEN $2 AND $3 
       ORDER BY created_at DESC`,
      [salaoId, startDate, endDate]
    );
  }

  async findByCliente(clienteId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT * FROM vendas 
       WHERE cliente_id = $1 AND salao_id = $2 
       ORDER BY created_at DESC`,
      [clienteId, salaoId]
    );
  }

  async findByProfissional(profissionalId, salaoId) {
    const { query } = require('../config/database');
    return await query(
      `SELECT * FROM vendas 
       WHERE profissional_id = $1 AND salao_id = $2 
       ORDER BY created_at DESC`,
      [profissionalId, salaoId]
    );
  }

  async getTotalVendasPorPeriodo(startDate, endDate, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      `SELECT COALESCE(SUM(valor_final), 0) as total 
       FROM vendas 
       WHERE salao_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
      [salaoId, startDate, endDate]
    );
  }

  async cancelar(id, salaoId) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      `UPDATE vendas SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND salao_id = $2 RETURNING *`,
      [id, salaoId]
    );
  }

  filterData(data) {
    const mapped = { ...data };
    if (mapped.clienteId !== undefined) {
      mapped.cliente_id = mapped.clienteId;
      delete mapped.clienteId;
    }
    if (mapped.profissionalId !== undefined || mapped.vendedorId !== undefined) {
      mapped.profissional_id = mapped.profissionalId || mapped.vendedorId;
      delete mapped.profissionalId;
      delete mapped.vendedorId;
    }
    if (mapped.total !== undefined && mapped.valor_total === undefined) {
      mapped.valor_total = mapped.total;
      mapped.valor_final = mapped.valor_final ?? mapped.total;
      delete mapped.total;
    }
    if (mapped.formaPagamento !== undefined) {
      mapped.forma_pagamento = mapped.formaPagamento;
      delete mapped.formaPagamento;
    }
    delete mapped.data;
    return mapped;
  }

  static async create(data, itens = [], salaoId = null) {
    const { withTransaction } = require('../config/database');
    const vendaModel = new Venda();
    return withTransaction(async (client) => {
      const payload = vendaModel.filterData({ ...data, salao_id: salaoId || data.salao_id });
      payload.status = payload.status || 'finalizada';
      payload.tipo = payload.tipo || 'produto';
      payload.desconto = payload.desconto || 0;
      payload.valor_final = payload.valor_final ?? payload.valor_total;

      const columns = Object.keys(payload).filter(k => /^[a-z_][a-z0-9_]*$/i.test(k));
      const values = columns.map(k => payload[k]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const vendaResult = await client.query(
        `INSERT INTO vendas (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      const venda = vendaResult.rows[0];

      for (const item of itens) {
        if (item.tipo && item.tipo !== 'produto') continue;
        const produtoId = item.produto_id || item.produtoId || item.itemId;
        if (!produtoId) continue;
        await client.query(`
          INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, valor_total)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          venda.id,
          produtoId,
          item.quantidade,
          item.preco_unitario || item.precoUnitario,
          item.valor_total || item.subtotal
        ]);
      }

      return venda;
    });
  }

  static async getAll(filters = {}, salaoId = null) {
    const { query } = require('../config/database');
    const params = [];
    let idx = 1;
    let sql = 'SELECT * FROM vendas WHERE 1=1';

    if (salaoId) {
      sql += ` AND salao_id = $${idx++}`;
      params.push(salaoId);
    }
    if (filters.clienteId) {
      sql += ` AND cliente_id = $${idx++}`;
      params.push(filters.clienteId);
    }
    if (filters.profissionalId || filters.vendedorId) {
      sql += ` AND profissional_id = $${idx++}`;
      params.push(filters.profissionalId || filters.vendedorId);
    }

    sql += ' ORDER BY created_at DESC';
    return query(sql, params);
  }
}

module.exports = Venda;
