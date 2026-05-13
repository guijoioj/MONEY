/**
 * Model Agendamento - Gerencia dados dos agendamentos do salão
 */

const BaseModel = require('./BaseModel');
const { query, queryOne } = require('../config/database');

class Agendamento extends BaseModel {
  constructor() {
    super('agendamentos');
  }

  /**
   * Busca agendamentos por cliente
   */
  async findByCliente(clienteId, status = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        p.nome as profissional_nome,
        s.nome as servico_nome
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE a.cliente_id = $1
    `;
    const params = [clienteId];
    
    if (status) {
      sql += ` AND a.status = $2`;
      params.push(status);
    }
    
    sql += ` ORDER BY a.data_hora DESC`;
    return query(sql, params);
  }

  /**
   * Busca agendamentos por profissional
   */
  async findByProfissional(profissionalId, dataInicio = null, dataFim = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        s.nome as servico_nome, s.duracao_minutos
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE a.profissional_id = $1
    `;
    const params = [profissionalId];
    
    if (dataInicio && dataFim) {
      sql += ` AND DATE(a.data_hora) BETWEEN $2 AND $3`;
      params.push(dataInicio, dataFim);
    }
    
    sql += ` ORDER BY a.data_hora`;
    return query(sql, params);
  }

  /**
   * Busca agendamentos do dia
   */
  async doDia(data, salaoId = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        p.nome as profissional_nome,
        s.nome as servico_nome, s.duracao_minutos
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE DATE(a.data_hora) = $1
    `;
    const params = [data];
    
    if (salaoId) {
      sql += ` AND a.salao_id = $2`;
      params.push(salaoId);
    }
    
    sql += ` ORDER BY a.data_hora`;
    return query(sql, params);
  }

  /**
   * Busca agendamentos por período
   */
  async porPeriodo(dataInicio, dataFim, salaoId = null, status = null) {
    let sql = `
      SELECT a.*, 
        c.nome as cliente_nome,
        p.nome as profissional_nome,
        s.nome as servico_nome
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id
      WHERE DATE(a.data_hora) BETWEEN $1 AND $2
    `;
    const params = [dataInicio, dataFim];
    let paramCount = 2;
    
    if (salaoId) {
      sql += ` AND a.salao_id = $${++paramCount}`;
      params.push(salaoId);
    }
    
    if (status) {
      sql += ` AND a.status = $${++paramCount}`;
      params.push(status);
    }
    
    sql += ` ORDER BY a.data_hora`;
    return query(sql, params);
  }

  /**
   * Verifica conflito de horário
   */
  async verificarConflito(profissionalId, dataHora, duracao, excludeId = null) {
    let sql = `
      SELECT COUNT(*) as total
      FROM agendamentos
      WHERE profissional_id = $1
      AND status NOT IN ('cancelado')
      AND (
        data_hora < $2::timestamp + INTERVAL '1 minute' * $3
        AND data_hora + INTERVAL '1 minute' * COALESCE(duracao_minutos, 30) > $2::timestamp
      )
    `;
    const params = [profissionalId, dataHora, duracao || 30];
    
    if (excludeId) {
      sql += ` AND id != $4`;
      params.push(excludeId);
    }
    
    const result = await queryOne(sql, params);
    return parseInt(result.total) > 0;
  }

  /**
   * Atualiza status do agendamento
   */
  async atualizarStatus(id, novoStatus, observacao = null) {
    const sql = `
      UPDATE agendamentos 
      SET status = $1, updated_at = CURRENT_TIMESTAMP, 
          observacoes = COALESCE($3, observacoes)
      WHERE id = $2 RETURNING *
    `;
    return queryOne(sql, [novoStatus, id, observacao]);
  }

  filterData(data) {
    const mapped = { ...data };
    if (mapped.clienteId !== undefined) {
      mapped.cliente_id = mapped.clienteId;
      delete mapped.clienteId;
    }
    if (mapped.profissionalId !== undefined) {
      mapped.profissional_id = mapped.profissionalId;
      delete mapped.profissionalId;
    }
    if (mapped.servicoId !== undefined) {
      mapped.servico_id = mapped.servicoId;
      delete mapped.servicoId;
    }
    if (mapped.dataHora !== undefined) {
      mapped.data_hora = mapped.dataHora;
      delete mapped.dataHora;
    }
    if (mapped.duracao !== undefined && mapped.duracao_minutos === undefined) {
      mapped.duracao_minutos = mapped.duracao;
      delete mapped.duracao;
    }
    return mapped;
  }

  static async getAll(filters = {}, salaoId = null) {
    let sql = `
      SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
      FROM agendamentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (salaoId) {
      sql += ` AND a.salao_id = $${idx++}`;
      params.push(salaoId);
    }
    if (filters.clienteId) {
      sql += ` AND a.cliente_id = $${idx++}`;
      params.push(filters.clienteId);
    }
    if (filters.profissionalId) {
      sql += ` AND a.profissional_id = $${idx++}`;
      params.push(filters.profissionalId);
    }
    if (filters.status) {
      sql += ` AND a.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.data) {
      sql += ` AND DATE(a.data_hora) = $${idx++}::date`;
      params.push(filters.data);
    }

    sql += ' ORDER BY a.data_hora DESC';
    return query(sql, params);
  }

  static async verificarDisponibilidade(profissionalId, dataHora, duracao = 30, salaoId = null) {
    const model = new Agendamento();
    const conflito = await model.verificarConflito(profissionalId, dataHora, duracao);
    if (salaoId) {
      const agendamento = await queryOne('SELECT salao_id FROM profissionais WHERE id = $1', [profissionalId]);
      if (agendamento && agendamento.salao_id !== Number(salaoId)) {
        return { disponivel: false };
      }
    }
    return { disponivel: !conflito };
  }

  static async proximoHorarioVago(profissionalId, dataHora, duracao = 30) {
    const base = new Date(dataHora);
    for (let i = 1; i <= 16; i++) {
      const tentativa = new Date(base.getTime() + i * 30 * 60000);
      const disponibilidade = await this.verificarDisponibilidade(profissionalId, tentativa.toISOString(), duracao);
      if (disponibilidade.disponivel) return tentativa.toISOString();
    }
    return null;
  }
}

module.exports = Agendamento;
