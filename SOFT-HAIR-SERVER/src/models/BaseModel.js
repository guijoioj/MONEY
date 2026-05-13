const { pool, query, queryOne, queryRun, withTransaction } = require('../config/database');

// Regex para validar nomes de colunas (prevenir SQL injection)
const VALID_COLUMN_NAME = /^[a-z_][a-z0-9_]*$/i;

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  static instance() {
    return new this();
  }

  static async findById(id, salaoId = null) {
    return this.instance().findById(id, salaoId);
  }

  static async getAll(filters = {}, salaoId = null, options = {}) {
    return this.instance().findAll(filters, salaoId, options);
  }

  static async findAll(filters = {}, salaoId = null, options = {}) {
    return this.instance().findAll(filters, salaoId, options);
  }

  static async create(data, salaoId = null) {
    return this.instance().create(data, salaoId);
  }

  static async update(id, data, salaoId = null) {
    return this.instance().update(id, data, salaoId);
  }

  static async delete(id, salaoId = null) {
    return this.instance().delete(id, salaoId);
  }

  static async count(filters = {}, salaoId = null) {
    return this.instance().count(filters, salaoId);
  }

  async findById(id, salaoId = null) {
    let sql = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    let params = [id];
    
    if (salaoId) {
      sql += ' AND salao_id = $2';
      params.push(salaoId);
    }
    
    return await queryOne(sql, params);
  }

  async findAll(filters = {}, salaoId = null, options = {}) {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    let params = [];
    let paramCount = 1;

    if (salaoId) {
      sql += ` AND salao_id = $${paramCount++}`;
      params.push(salaoId);
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;
      
      // Sanitizar nome da coluna
      if (!VALID_COLUMN_NAME.test(key)) {
        console.warn(`[BaseModel] Coluna inválida ignorada: ${key}`);
        continue;
      }

      if (typeof value === 'boolean') {
        sql += ` AND ${key} = $${paramCount++}`;
        params.push(value);
      } else if (typeof value === 'string' && value.includes('%')) {
        sql += ` AND ${key} ILIKE $${paramCount++}`;
        params.push(value);
      } else {
        sql += ` AND ${key} = $${paramCount++}`;
        params.push(value);
      }
    }

    sql += ` ORDER BY ${options.orderBy || 'created_at'} ${options.order === 'ASC' ? 'ASC' : 'DESC'}`;

    // Paginação no SQL
    const limit = Math.min(parseInt(options.limit) || 50, 500);
    const offset = Math.max(parseInt(options.offset) || 0, 0);
    sql += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    return await query(sql, params);
  }

  async create(data, salaoId = null) {
    const filteredData = this.filterData(data);
    
    if (salaoId) {
      filteredData.salao_id = salaoId;
    }

    // Sanitizar nomes de colunas
    const columns = Object.keys(filteredData).filter(k => VALID_COLUMN_NAME.test(k));
    const values = columns.map(k => filteredData[k]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    return await queryOne(sql, values);
  }

  async update(id, data, salaoId = null) {
    const filteredData = this.filterData(data);
    let sql = `UPDATE ${this.tableName} SET `;
    let params = [];
    let paramCount = 1;

    const sets = [];
    for (const [key, value] of Object.entries(filteredData)) {
      if (key === 'id' || key === 'created_at' || key === 'salao_id') continue;
      if (!VALID_COLUMN_NAME.test(key)) continue;
      
      sets.push(`${key} = $${paramCount++}`);
      params.push(value);
    }

    if (sets.length === 0) {
      return null;
    }

    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    sql += sets.join(', ');
    
    sql += ` WHERE id = $${paramCount++}`;
    params.push(id);

    if (salaoId) {
      sql += ` AND salao_id = $${paramCount++}`;
      params.push(salaoId);
    }

    sql += ` RETURNING *`;

    return await queryOne(sql, params);
  }

  async delete(id, salaoId = null) {
    let sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
    let params = [id];

    if (salaoId) {
      sql += ' AND salao_id = $2';
      params.push(salaoId);
    }

    sql += ` RETURNING *`;

    return await queryOne(sql, params);
  }

  async count(filters = {}, salaoId = null) {
    let sql = `SELECT COUNT(*) FROM ${this.tableName} WHERE 1=1`;
    let params = [];
    let paramCount = 1;

    if (salaoId) {
      sql += ` AND salao_id = $${paramCount++}`;
      params.push(salaoId);
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && VALID_COLUMN_NAME.test(key)) {
        sql += ` AND ${key} = $${paramCount++}`;
        params.push(value);
      }
    });

    const result = await queryOne(sql, params);
    return parseInt(result.count);
  }

  filterData(data) {
    return data;
  }

  async withTransaction(fn) {
    return await withTransaction(fn);
  }
}

module.exports = BaseModel;
