const { query, queryOne } = require('../config/database');

class PontoRegistro {
  static async create(data) {
    return queryOne(`
      INSERT INTO registros_ponto (salao_id, profissional_id, tipo)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [data.salao_id || data.salonId, data.profissional_id || data.profissionalId, data.tipo]);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM registros_ponto WHERE id = $1', [id]);
  }

  static async getByProfissional(profissionalId, salaoId, data) {
    const params = [profissionalId, salaoId];
    let sql = 'SELECT * FROM registros_ponto WHERE profissional_id = $1 AND salao_id = $2';
    if (data) {
      sql += ' AND DATE(created_at) = $3::date';
      params.push(data);
    }
    sql += ' ORDER BY created_at';
    return query(sql, params);
  }

  static async getUltimoPonto(profissionalId, salaoId) {
    return queryOne(`
      SELECT * FROM registros_ponto
      WHERE profissional_id = $1 AND salao_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [profissionalId, salaoId]);
  }

  static async getResumoHoje(profissionalId, salaoId) {
    const registros = await this.getByProfissional(profissionalId, salaoId, new Date().toISOString().split('T')[0]);
    const entrada = registros.find(r => r.tipo === 'entrada');
    const saida = [...registros].reverse().find(r => r.tipo === 'saida');
    const horas = entrada && saida
      ? ((new Date(saida.created_at) - new Date(entrada.created_at)) / 3600000).toFixed(1)
      : null;
    return { registros, entrada, saida, horasTrabalhadas: horas };
  }
}

module.exports = PontoRegistro;
