const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class Servico {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO servicos (id, nome, descricao, duracao, preco, categoria, ativo, "baseComissao", "comissaoPorcentagem", "salonId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.nome, data.descricao||null, data.duracao, data.preco, data.categoria||null, data.ativo!==undefined?Boolean(data.ativo):true, data.baseComissao||0, data.comissaoPorcentagem||0, salonId]
    );
    return this.findById(id, salonId);
  }

  static async findById(id, salonId) {
    const sql = salonId ? 'SELECT * FROM servicos WHERE id = ? AND "salonId" = ?' : 'SELECT * FROM servicos WHERE id = ?';
    return queryOne(sql, salonId ? [id, salonId] : [id]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = 'SELECT * FROM servicos WHERE "salonId" = ?';
    const params = [salonId];
    if (filters.categoria) { sql += ' AND categoria = ?'; params.push(filters.categoria); }
    if (filters.ativo !== undefined) {
      if (filters.ativo === 'false' || filters.ativo === false) { sql += ' AND ativo = false'; }
      else if (filters.ativo === 'true' || filters.ativo === true) { sql += ' AND ativo = true'; }
    }
    if (filters.search) { sql += ' AND (nome ILIKE ? OR descricao ILIKE ?)'; const s=`%${filters.search}%`; params.push(s,s); }
    sql += ' ORDER BY nome ASC';
    return query(sql, params);
  }

  static async update(id, data, salonId) {
    const fields = [], values = [];
    const allowed = ['nome','descricao','duracao','preco','categoria','ativo','baseComissao','comissaoPorcentagem'];
    for (const [k,v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(k==='ativo'?Boolean(v):v); }
    }
    if (!fields.length) return this.findById(id, salonId);
    fields.push('"updatedAt" = NOW()');
    values.push(id, salonId);
    await queryRun(`UPDATE servicos SET ${fields.join(', ')} WHERE id = ? AND "salonId" = ?`, values);
    return this.findById(id, salonId);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM servicos WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async getCategorias(salonId) {
    const rows = await query("SELECT DISTINCT categoria FROM servicos WHERE \"salonId\" = ? AND categoria IS NOT NULL AND categoria <> ''", [salonId]);
    return rows.map(r => r.categoria);
  }
}

module.exports = Servico;
