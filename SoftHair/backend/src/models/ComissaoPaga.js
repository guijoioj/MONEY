const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class ComissaoPaga {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO comissoes_pagas (id, "profissionalId", "fechamentoId", valor, "dataPagamento", observacoes, "salonId") VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.profissionalId, data.fechamentoId||null, data.valor, data.dataPagamento||new Date().toISOString().split('T')[0], data.observacoes||null, salonId]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(`SELECT cp.*, p.nome as "profissionalNome" FROM comissoes_pagas cp LEFT JOIN profissionais p ON cp."profissionalId" = p.id WHERE cp.id = ?`, [id]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = `SELECT cp.*, p.nome as "profissionalNome" FROM comissoes_pagas cp LEFT JOIN profissionais p ON cp."profissionalId" = p.id WHERE cp."salonId" = ?`;
    const params = [salonId];
    if (filters.profissionalId) { sql += ' AND cp."profissionalId" = ?'; params.push(filters.profissionalId); }
    if (filters.dataInicio && filters.dataFim) { sql += ' AND cp."dataPagamento"::date BETWEEN ?::date AND ?::date'; params.push(filters.dataInicio, filters.dataFim); }
    if (filters.data) { sql += ' AND cp."dataPagamento"::date = ?::date'; params.push(filters.data); }
    sql += ' ORDER BY cp."dataPagamento" DESC, cp."createdAt" DESC';
    return query(sql, params);
  }

  static async getTotalPago(profissionalId = null, salonId) {
    let sql = 'SELECT COALESCE(SUM(valor),0) as total FROM comissoes_pagas WHERE "salonId" = ?';
    const params = [salonId];
    if (profissionalId) { sql += ' AND "profissionalId" = ?'; params.push(profissionalId); }
    const row = await queryOne(sql, params);
    return parseFloat(row?.total||0);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM comissoes_pagas WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }
}

module.exports = ComissaoPaga;
