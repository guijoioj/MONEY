const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class Profissional {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO profissionais (id, nome, telefone, email, endereco, especialidade, comissao, ativo, "salonId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.nome, data.telefone||null, data.email||null, data.endereco||null, data.especialidade||null, data.comissao||0, data.ativo!==undefined?(data.ativo?1:0):1, salonId]
    );
    return this.findById(id, salonId);
  }

  static async findById(id, salonId) {
    const sql = salonId
      ? 'SELECT * FROM profissionais WHERE id = ? AND "salonId" = ?'
      : 'SELECT * FROM profissionais WHERE id = ?';
    const params = salonId ? [id, salonId] : [id];
    return queryOne(sql, params);
  }

  static async getAll(filters = {}, salonId) {
    let sql = 'SELECT * FROM profissionais WHERE "salonId" = ?';
    const params = [salonId];
    if (filters.ativo !== undefined) {
      if (filters.ativo === 'false' || filters.ativo === false) { sql += ' AND ativo = 0'; }
      else if (filters.ativo === 'true' || filters.ativo === true) { sql += ' AND ativo = 1'; }
    }
    if (filters.search) {
      sql += ' AND (nome ILIKE ? OR telefone ILIKE ? OR email ILIKE ?)';
      const s = `%${filters.search}%`; params.push(s, s, s);
    }
    sql += ' ORDER BY nome ASC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
    return query(sql, params);
  }

  static async update(id, data, salonId) {
    const fields = [], values = [];
    const allowed = ['nome','telefone','email','endereco','especialidade','comissao','ativo'];
    for (const [k,v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(k==='ativo'?(v?1:0):v); }
    }
    if (!fields.length) return this.findById(id, salonId);
    fields.push('"updatedAt" = NOW()');
    values.push(id, salonId);
    await queryRun(`UPDATE profissionais SET ${fields.join(', ')} WHERE id = ? AND "salonId" = ?`, values);
    return this.findById(id, salonId);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM profissionais WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }
}

module.exports = Profissional;
