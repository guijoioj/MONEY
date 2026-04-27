const { query, queryOne, withTransaction } = require('../config/database');

class AtendimentoService {
  async listar(salaoId, filtros = {}) {
    try {
      let sql = `
        SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
        FROM atendimentos a
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.salao_id = $1
      `;
      const params = [salaoId];
      let paramCount = 2;

      if (filtros.status) {
        sql += ` AND a.status = $${paramCount++}`;
        params.push(filtros.status);
      }
      if (filtros.profissional_id) {
        sql += ` AND a.profissional_id = $${paramCount++}`;
        params.push(filtros.profissional_id);
      }
      if (filtros.data_inicio && filtros.data_fim) {
        sql += ` AND DATE(a.created_at) BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(filtros.data_inicio, filtros.data_fim);
      }

      sql += ' ORDER BY a.created_at DESC';

      if (filtros.limit) {
        sql += ` LIMIT $${paramCount++}`;
        params.push(parseInt(filtros.limit) || 50);
      }

      const data = await query(sql, params);
      return { success: true, data };
    } catch (error) {
      console.error('[AtendimentoService] Erro ao listar:', error);
      return { success: false, error: error.message };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const data = await queryOne(`
        SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
        FROM atendimentos a
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.id = $1 AND a.salao_id = $2
      `, [id, salaoId]);

      if (!data) return { success: false, error: 'Atendimento não encontrado' };
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async criar(data, salaoId) {
    try {
      const result = await queryOne(`
        INSERT INTO atendimentos (cliente_id, profissional_id, servico_id, agendamento_id, valor, status, observacoes, salao_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [data.cliente_id, data.profissional_id, data.servico_id, data.agendamento_id || null,
          data.valor || 0, data.status || 'em_andamento', data.observacoes || null, salaoId]);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const existing = await queryOne('SELECT id FROM atendimentos WHERE id = $1 AND salao_id = $2', [id, salaoId]);
      if (!existing) return { success: false, error: 'Atendimento não encontrado' };

      const result = await queryOne(`
        UPDATE atendimentos SET
          status = COALESCE($1, status),
          observacoes = COALESCE($2, observacoes),
          valor = COALESCE($3, valor),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND salao_id = $5 RETURNING *
      `, [data.status, data.observacoes, data.valor, id, salaoId]);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deletar(id, salaoId) {
    try {
      const result = await queryOne('DELETE FROM atendimentos WHERE id = $1 AND salao_id = $2 RETURNING id', [id, salaoId]);
      if (!result) return { success: false, error: 'Atendimento não encontrado' };
      return { success: true, message: 'Atendimento removido' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = AtendimentoService;
