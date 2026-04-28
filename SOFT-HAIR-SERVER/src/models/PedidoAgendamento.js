const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class PedidoAgendamento {
  static async create(data) {
    const id = uuidv4();
    await queryRun(
      `INSERT INTO pedidos_agendamento (id,"salonId","clienteAppId","servicoId","profissionalId","dataDesejada","horarioDesejado","horarioAlternativo",observacoes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, data.salonId, data.clienteAppId, data.servicoId, data.profissionalId||null, data.dataDesejada, data.horarioDesejado, data.horarioAlternativo||null, data.observacoes||null]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(`
      SELECT pa.*, s.nome as "servicoNome", s.preco as "servicoPreco", s.duracao as "servicoDuracao",
             p.nome as "profissionalNome", ca.nome as "clienteNome", ca.telefone as "clienteTelefone",
             sl.nome as "salaoNome"
      FROM pedidos_agendamento pa
      LEFT JOIN servicos s ON pa."servicoId" = s.id
      LEFT JOIN profissionais p ON pa."profissionalId" = p.id
      LEFT JOIN clientes_app ca ON pa."clienteAppId" = ca.id
      LEFT JOIN saloes sl ON pa."salonId" = sl.id
      WHERE pa.id = ?
    `, [id]);
  }

  static async getByCliente(clienteAppId) {
    return query(`
      SELECT pa.*, s.nome as "servicoNome", s.preco as "servicoPreco",
             p.nome as "profissionalNome", sl.nome as "salaoNome"
      FROM pedidos_agendamento pa
      LEFT JOIN servicos s ON pa."servicoId" = s.id
      LEFT JOIN profissionais p ON pa."profissionalId" = p.id
      LEFT JOIN saloes sl ON pa."salonId" = sl.id
      WHERE pa."clienteAppId" = ? ORDER BY pa."createdAt" DESC
    `, [clienteAppId]);
  }

  static async getBySalao(salonId, filters = {}) {
    let sql = `
      SELECT pa.*, s.nome as "servicoNome", p.nome as "profissionalNome",
             ca.nome as "clienteNome", ca.telefone as "clienteTelefone"
      FROM pedidos_agendamento pa
      LEFT JOIN servicos s ON pa."servicoId" = s.id
      LEFT JOIN profissionais p ON pa."profissionalId" = p.id
      LEFT JOIN clientes_app ca ON pa."clienteAppId" = ca.id
      WHERE pa."salonId" = ?
    `;
    const params = [salonId];
    if (filters.status) { sql += ' AND pa.status = ?'; params.push(filters.status); }
    sql += ' ORDER BY pa."createdAt" DESC';
    return query(sql, params);
  }

  static async aprovar(id, salonId, agendamentoId, atendidoPor) {
    await queryRun(
      `UPDATE pedidos_agendamento SET status='aprovado',"agendamentoId"=?,"atendidoPor"=?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?`,
      [agendamentoId||null, atendidoPor||null, id, salonId]
    );
    return this.findById(id);
  }

  static async rejeitar(id, salonId, motivo) {
    await queryRun(
      `UPDATE pedidos_agendamento SET status='rejeitado',"motivoRejeicao"=?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?`,
      [motivo||null, id, salonId]
    );
    return this.findById(id);
  }
}

module.exports = PedidoAgendamento;
