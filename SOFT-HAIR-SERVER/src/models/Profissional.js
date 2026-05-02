/**
 * Model Profissional - Gerencia dados dos profissionais do salão
 */

const BaseModel = require('./BaseModel');

class Profissional extends BaseModel {
  constructor() {
    super('profissionais');
  }

  /**
   * Busca profissionais ativos por salão
   */
  async buscarAtivosPorSalao(salaoId) {
    const sql = `
      SELECT * FROM profissionais 
      WHERE salao_id = $1 AND ativo = true 
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId]);
  }

  /**
   * Busca profissional por usuário vinculado
   */
  async findByUsuario(usuarioId) {
    const sql = `SELECT * FROM profissionais WHERE usuario_id = $1`;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [usuarioId]);
  }

  /**
   * Busca profissionais por especialidade
   */
  async findByEspecialidade(especialidade) {
    const sql = `
      SELECT * FROM profissionais 
      WHERE ativo = true AND especialidades ILIKE $1
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [`%${especialidade}%`]);
  }

  /**
   * Busca profissionais disponíveis para agendamento
   */
  async disponiveisParaData(data, horaInicio, horaFim) {
    const sql = `
      SELECT p.* FROM profissionais p
      WHERE p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.profissional_id = p.id
        AND DATE(a.data_hora) = $1::date
        AND a.data_hora < ($1::date + $3::time)
        AND (a.data_hora + INTERVAL '1 minute' * COALESCE(a.duracao_minutos, 30)) > ($1::date + $2::time)
        AND a.status NOT IN ('cancelado', 'nao_compareceu')
      )
      ORDER BY p.nome
    `;
    const { query } = require('../config/database');
    return query(sql, [data, horaInicio, horaFim]);
  }

  /**
   * Retorna comissões do período
   */
  async comissoesPeriodo(profissionalId, dataInicio, dataFim) {
    const sql = `
      SELECT 
        COALESCE(SUM(valor_total), 0) as total_servicos,
        0 as total_produtos,
        COALESCE(SUM(valor_comissao), 0) as total_comissoes
      FROM comissoes
      WHERE profissional_id = $1
      AND DATE(created_at) BETWEEN $2::date AND $3::date
      AND pago = false
    `;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [profissionalId, dataInicio, dataFim]);
  }
}

module.exports = Profissional;
