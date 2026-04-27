/**
 * Model Produto - Gerencia dados dos produtos do salão
 */

const BaseModel = require('./BaseModel');

class Produto extends BaseModel {
  constructor() {
    super('produtos');
  }

  /**
   * Busca produtos ativos por salão
   */
  async buscarAtivosPorSalao(salaoId) {
    const sql = `
      SELECT * FROM produtos 
      WHERE salao_id = $1 AND ativo = true 
      ORDER BY categoria, nome
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId]);
  }

  /**
   * Busca produtos em estoque baixo
   */
  async estoqueBaixo(salaoId) {
    const sql = `
      SELECT * FROM produtos 
      WHERE salao_id = $1 
      AND ativo = true 
      AND quantidade <= quantidade_minima
      ORDER BY quantidade ASC
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId]);
  }

  /**
   * Busca produtos por categoria
   */
  async findByCategoria(categoria) {
    const sql = `
      SELECT * FROM produtos 
      WHERE categoria = $1 AND ativo = true
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [categoria]);
  }

  /**
   * Busca produtos por termo
   */
  async buscarPorTermo(termo) {
    const sql = `
      SELECT * FROM produtos 
      WHERE ativo = true 
      AND (nome ILIKE $1 OR descricao ILIKE $1 OR marca ILIKE $1 OR categoria ILIKE $1)
      ORDER BY nome
    `;
    const { query } = require('../config/database');
    return query(sql, [`%${termo}%`]);
  }

  /**
   * Atualiza quantidade em estoque
   */
  async atualizarEstoque(id, quantidade) {
    const sql = `
      UPDATE produtos 
      SET quantidade = quantidade + $1, data_atualizacao = CURRENT_TIMESTAMP 
      WHERE id = $2 RETURNING *
    `;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [quantidade, id]);
  }

  /**
   * Verifica se há quantidade disponível
   */
  async verificarDisponibilidade(id, quantidade) {
    const sql = `
      SELECT id, nome, quantidade, quantidade_minima,
        CASE WHEN quantidade >= $1 THEN true ELSE false END as disponivel
      FROM produtos WHERE id = $2
    `;
    const { queryOne } = require('../config/database');
    return queryOne(sql, [quantidade, id]);
  }

  /**
   * Busca produtos mais vendidos
   */
  async maisVendidos(salaoId, limite = 5) {
    const sql = `
      SELECT p.*, COALESCE(SUM(iv.quantidade), 0) as total_vendido
      FROM produtos p
      LEFT JOIN vendas v ON v.salao_id = p.salao_id 
        AND v.status = 'finalizada'
        AND v.data_venda >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN itens_venda iv ON iv.venda_id = v.id AND iv.produto_id = p.id
      WHERE p.salao_id = $1 AND p.ativo = true
      GROUP BY p.id
      ORDER BY total_vendido DESC
      LIMIT $2
    `;
    const { query } = require('../config/database');
    return query(sql, [salaoId, limite]);
  }
}

module.exports = Produto;