/**
 * Model Servico - Gerencia dados dos serviços oferecidos pelo salão
 */

const BaseModel = require('./BaseModel');

class Servico extends BaseModel {
  constructor() {
    super('servicos');
  }

  /**
   * Busca serviços ativos por salão
   */
  async buscarAtivosPorSalao(salaoId) {
    const sql = `
      SELECT * FROM servicos 
      WHERE salao_id = $1 AND ativo = true 
      ORDER BY categoria, nome
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId]);
  }

  /**
   * Busca serviços por categoria
   */
  async findByCategoria(categoria) {
    const sql = `
      SELECT * FROM servicos 
      WHERE categoria = $1 AND ativo = true
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [categoria]);
  }

  /**
   * Busca serviços por faixa de preço
   */
  async findByFaixaPreco(precoMin, precoMax) {
    const sql = `
      SELECT * FROM servicos 
      WHERE preco BETWEEN $1 AND $2 AND ativo = true
      ORDER BY preco, nome
    `;
    const { query } = require('../config/database');
    return query(sql, [precoMin, precoMax]);
  }

  /**
   * Busca serviços populares (mais agendados)
   */
  async servicosPopulares(salaoId, limite = 5) {
    const sql = `
      SELECT s.*, COUNT(a.id) as total_agenda
      FROM servicos s
      LEFT JOIN agendamentos a ON a.servico_id = s.id 
        AND a.status = 'concluido'
        AND a.data_hora >= CURRENT_DATE - INTERVAL '30 days'
      WHERE s.salao_id = $1 AND s.ativo = true
      GROUP BY s.id
      ORDER BY total_agenda DESC, s.nome
      LIMIT $2
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId, limite]);
  }

  /**
   * Busca serviços compatíveis com duração máxima
   */
  async findByDuracaoMax(duracaoMaxima) {
    const sql = `
      SELECT * FROM servicos 
      WHERE duracao_minutos <= $1 AND ativo = true
      ORDER BY duracao_minutos
    `;
    const { query } = require('../config/database');
    return query(sql, [duracaoMaxima]);
  }

  /**
   * Busca serviços por termo
   */
  async buscarPorTermo(termo) {
    const sql = `
      SELECT * FROM servicos 
      WHERE ativo = true 
      AND (nome ILIKE $1 OR descricao ILIKE $1)
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [`%${termo}%`]);
  }
}

module.exports = Servico;
