const Agendamento = require('../models/Agendamento');

class AgendamentoService {
  async listar(salaoId, filtros = {}) {
    try {
      const { query } = require('../config/database');
      
      let sql = `
        SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome,
               aux.nome as auxiliar_nome, s.nome as servico_nome
        FROM agendamentos a
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN profissionais aux ON aux.id = a.auxiliar_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.salao_id = $1
      `;
      let params = [salaoId];
      let paramCount = 2;

      if (filtros.status) {
        sql += ` AND a.status = $${paramCount++}`;
        params.push(filtros.status);
      }

      if (filtros.data_inicio && filtros.data_fim) {
        sql += ` AND DATE(a.data_hora) BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(filtros.data_inicio, filtros.data_fim);
      }

      if (filtros.cliente_id) {
        sql += ` AND a.cliente_id = $${paramCount++}`;
        params.push(filtros.cliente_id);
      }

      if (filtros.profissional_id) {
        sql += ` AND a.profissional_id = $${paramCount++}`;
        params.push(filtros.profissional_id);
      }

      // Se nenhum filtro de data foi passado, limita ao período relevante (60 dias atrás até 365 dias à frente)
      if (!filtros.data_inicio && !filtros.data_fim) {
        sql += ` AND DATE(a.data_hora) BETWEEN (CURRENT_DATE - INTERVAL '60 days') AND (CURRENT_DATE + INTERVAL '365 days')`;
      }

      sql += ` ORDER BY a.data_hora ASC`;

      const agendamentos = await query(sql, params);
      
      return {
        success: true,
        data: agendamentos
      };
    } catch (error) {
      console.error('Erro ao listar agendamentos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const { query } = require('../config/database');
      
      const agendamento = await query(`
        SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
               p.nome as profissional_nome, s.nome as servico_nome
        FROM agendamentos a
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.id = $1 AND a.salao_id = $2
      `, [id, salaoId]);
      
      if (!agendamento || agendamento.length === 0) {
        return {
          success: false,
          error: 'Agendamento não encontrado'
        };
      }

      return {
        success: true,
        data: agendamento[0]
      };
    } catch (error) {
      console.error('Erro ao buscar agendamento:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async criar(data, salaoId) {
    try {
      const { queryOne } = require('../config/database');
      
      const result = await queryOne(`
        INSERT INTO agendamentos (cliente_id, profissional_id, auxiliar_id, servico_id, data_hora,
                                  observacoes, valor, status, salao_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        data.cliente_id,
        data.profissional_id,
        data.auxiliar_id || null,
        data.servico_id,
        data.data_hora,
        data.observacoes || null,
        data.valor || 0,
        data.status || 'agendado',
        salaoId
      ]);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const { queryOne } = require('../config/database');
      
      const result = await queryOne(`
        UPDATE agendamentos
        SET cliente_id = COALESCE($1, cliente_id),
            profissional_id = COALESCE($2, profissional_id),
            auxiliar_id = $3,
            servico_id = COALESCE($4, servico_id),
            data_hora = COALESCE($5, data_hora),
            observacoes = COALESCE($6, observacoes),
            valor = COALESCE($7, valor),
            status = COALESCE($8, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND salao_id = $10
        RETURNING *
      `, [
        data.cliente_id,
        data.profissional_id,
        data.auxiliar_id !== undefined ? data.auxiliar_id : null,
        data.servico_id,
        data.data_hora,
        data.observacoes,
        data.valor,
        data.status,
        id,
        salaoId
      ]);

      if (!result) {
        return {
          success: false,
          error: 'Agendamento não encontrado'
        };
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cancelar(id, motivo, salaoId) {
    try {
      const { queryOne } = require('../config/database');
      
      const result = await queryOne(`
        UPDATE agendamentos 
        SET status = 'cancelado',
            observacoes = COALESCE(observacoes || E'\\nCancelado: ', '') || $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND salao_id = $3
        RETURNING *
      `, [id, motivo, salaoId]);

      if (!result) {
        return {
          success: false,
          error: 'Agendamento não encontrado'
        };
      }

      return {
        success: true,
        data: result,
        message: 'Agendamento cancelado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHorariosDisponiveis(profissionalId, data, salaoId) {
    try {
      const { query } = require('../config/database');
      
      const agendamentos = await query(`
        SELECT data_hora, duracao_minutos
        FROM agendamentos a
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE profissional_id = $1 
        AND salao_id = $2
        AND DATE(data_hora) = $3
        AND status != 'cancelado'
        ORDER BY data_hora
      `, [profissionalId, salaoId, data]);

      return {
        success: true,
        data: agendamentos
      };
    } catch (error) {
      console.error('Erro ao buscar horários disponíveis:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  async deletar(id, salaoId) {
    try {
      const { queryOne } = require('../config/database');
      const result = await queryOne(
        `DELETE FROM agendamentos WHERE id = $1 AND salao_id = $2 RETURNING id`,
        [id, salaoId]
      );
      if (!result) return { success: false, error: 'Agendamento não encontrado' };
      return { success: true, message: 'Agendamento excluído' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = AgendamentoService;