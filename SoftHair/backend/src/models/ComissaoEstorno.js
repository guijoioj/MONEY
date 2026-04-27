const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class ComissaoEstorno {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO comissoes_estornos (id, "comissaoPagaId", "profissionalId", valor, motivo, "salonId") VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.comissaoPagaId||null, data.profissionalId, data.valor, data.motivo, salonId]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(`SELECT ce.*, p.nome as "profissionalNome" FROM comissoes_estornos ce LEFT JOIN profissionais p ON ce."profissionalId" = p.id WHERE ce.id = ?`, [id]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = `SELECT ce.*, p.nome as "profissionalNome" FROM comissoes_estornos ce LEFT JOIN profissionais p ON ce."profissionalId" = p.id WHERE ce."salonId" = ?`;
    const params = [salonId];
    if (filters.profissionalId) { sql += ' AND ce."profissionalId" = ?'; params.push(filters.profissionalId); }
    if (filters.dataInicio && filters.dataFim) { sql += ' AND ce."createdAt"::date BETWEEN ?::date AND ?::date'; params.push(filters.dataInicio, filters.dataFim); }
    sql += ' ORDER BY ce."createdAt" DESC';
    return query(sql, params);
  }

  static async getTotalEstornado(profissionalId = null, salonId) {
    let sql = 'SELECT COALESCE(SUM(valor),0) as total FROM comissoes_estornos WHERE "salonId" = ?';
    const params = [salonId];
    if (profissionalId) { sql += ' AND "profissionalId" = ?'; params.push(profissionalId); }
    const row = await queryOne(sql, params);
    return parseFloat(row?.total||0);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM comissoes_estornos WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }
}

module.exports = ComissaoEstorno;
