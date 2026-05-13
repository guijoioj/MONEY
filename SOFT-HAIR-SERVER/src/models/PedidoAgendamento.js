const { query, queryOne } = require('../config/database');

function dateOnly(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toShape(row) {
  if (!row) return null;
  return {
    ...row,
    salonId: row.salao_id,
    clienteAppId: row.cliente_app_id,
    servicoId: row.servico_id,
    profissionalId: row.profissional_id,
    dataDesejada: dateOnly(row.data_desejada),
    horarioDesejado: row.horario_desejado,
    horarioAlternativo: row.horario_alternativo,
    agendamentoId: row.agendamento_id,
    atendidoPor: row.atendido_por,
    motivoRejeicao: row.motivo_rejeicao,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class PedidoAgendamento {
  static async create(data) {
    const row = await queryOne(`
      INSERT INTO pedidos_agendamento (
        salao_id, cliente_app_id, servico_id, profissional_id,
        data_desejada, horario_desejado, horario_alternativo, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.salao_id || data.salonId,
      data.cliente_app_id || data.clienteAppId,
      data.servico_id || data.servicoId,
      data.profissional_id || data.profissionalId || null,
      data.data_desejada || data.dataDesejada,
      data.horario_desejado || data.horarioDesejado,
      data.horario_alternativo || data.horarioAlternativo || null,
      data.observacoes || null
    ]);
    return this.findById(row.id);
  }

  static async findById(id) {
    return toShape(await queryOne(`
      SELECT pa.*, s.nome as "servicoNome", s.preco as "servicoPreco", s.duracao_minutos as "servicoDuracao",
             p.nome as "profissionalNome", ca.nome as "clienteNome", ca.telefone as "clienteTelefone",
             sl.nome as "salaoNome"
      FROM pedidos_agendamento pa
      LEFT JOIN servicos s ON pa.servico_id = s.id
      LEFT JOIN profissionais p ON pa.profissional_id = p.id
      LEFT JOIN clientes_app ca ON pa.cliente_app_id = ca.id
      LEFT JOIN saloes sl ON pa.salao_id = sl.id
      WHERE pa.id = $1
    `, [id]));
  }

  static async getByCliente(clienteAppId) {
    const rows = await query(`
      SELECT pa.*, s.nome as "servicoNome", s.preco as "servicoPreco",
             p.nome as "profissionalNome", sl.nome as "salaoNome"
      FROM pedidos_agendamento pa
      LEFT JOIN servicos s ON pa.servico_id = s.id
      LEFT JOIN profissionais p ON pa.profissional_id = p.id
      LEFT JOIN saloes sl ON pa.salao_id = sl.id
      WHERE pa.cliente_app_id = $1
      ORDER BY pa.created_at DESC
    `, [clienteAppId]);
    return rows.map(toShape);
  }

  static async getBySalao(salaoId, filters = {}) {
    const params = [salaoId];
    let idx = 2;
    let sql = `
      SELECT pa.*, s.nome as "servicoNome", p.nome as "profissionalNome",
             ca.nome as "clienteNome", ca.telefone as "clienteTelefone"
      FROM pedidos_agendamento pa
      LEFT JOIN servicos s ON pa.servico_id = s.id
      LEFT JOIN profissionais p ON pa.profissional_id = p.id
      LEFT JOIN clientes_app ca ON pa.cliente_app_id = ca.id
      WHERE pa.salao_id = $1
    `;
    if (filters.status) {
      sql += ` AND pa.status = $${idx++}`;
      params.push(filters.status);
    }
    sql += ' ORDER BY pa.created_at DESC';
    const rows = await query(sql, params);
    return rows.map(toShape);
  }

  static async aprovar(id, salaoId, agendamentoId, atendidoPor) {
    await query(`
      UPDATE pedidos_agendamento
      SET status = 'aprovado', agendamento_id = $1, atendido_por = $2, updated_at = NOW()
      WHERE id = $3 AND salao_id = $4
    `, [agendamentoId || null, atendidoPor || null, id, salaoId]);
    return this.findById(id);
  }

  static async rejeitar(id, salaoId, motivo) {
    await query(`
      UPDATE pedidos_agendamento
      SET status = 'rejeitado', motivo_rejeicao = $1, updated_at = NOW()
      WHERE id = $2 AND salao_id = $3
    `, [motivo || null, id, salaoId]);
    return this.findById(id);
  }
}

module.exports = PedidoAgendamento;
