const BaseModel = require('./BaseModel');

class Salao extends BaseModel {
  constructor() {
    super('saloes');
  }

  async findByEmail(email) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      'SELECT * FROM saloes WHERE email = $1 AND ativo = true',
      [email]
    );
  }

  async findByCnpj(cnpj) {
    const { queryOne } = require('../config/database');
    return await queryOne(
      'SELECT * FROM saloes WHERE cnpj = $1 AND ativo = true',
      [cnpj]
    );
  }

  async getStats(salaoId) {
    const { queryOne } = require('../config/database');
    const stats = await queryOne(`
      SELECT 
        (SELECT COUNT(*) FROM clientes WHERE salao_id = $1) as total_clientes,
        (SELECT COUNT(*) FROM profissionais WHERE salao_id = $1 AND ativo = true) as total_profissionais,
        (SELECT COUNT(*) FROM agendamentos WHERE salao_id = $1 AND DATE(data_hora) = CURRENT_DATE) as agendamentos_hoje,
        (SELECT COUNT(*) FROM vendas WHERE salao_id = $1 AND DATE(created_at) = CURRENT_DATE) as vendas_hoje
    `, [salaoId]);
    
    return stats;
  }

  async deactivate(salaoId) {
    const { query } = require('../config/database');
    return await query(
      'UPDATE saloes SET ativo = false WHERE id = $1',
      [salaoId]
    );
  }
}

module.exports = Salao;