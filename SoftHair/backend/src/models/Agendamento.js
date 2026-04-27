const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

const JOIN = `
  SELECT a.*, c.nome as "clienteNome", c.telefone as "clienteTelefone",
         s.nome as "servicoNome", s.preco as "servicoPreco", s.duracao as "servicoDuracao",
         p.nome as "profissionalNome", aux.nome as "auxiliarNome"
  FROM agendamentos a
  LEFT JOIN clientes c ON a."clienteId" = c.id
  LEFT JOIN servicos s ON a."servicoId" = s.id
  LEFT JOIN profissionais p ON a."profissionalId" = p.id
  LEFT JOIN profissionais aux ON a."auxiliarId" = aux.id
`;

class Agendamento {
  static async create(data, salonId) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO agendamentos (id, "clienteId", "servicoId", "profissionalId", "auxiliarId", "dataHora", duracao, status, observacoes, "salonId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.clienteId, data.servicoId, data.profissionalId||null, data.auxiliarId||null, data.dataHora, data.duracao||null, data.status||'agendado', data.observacoes||null, salonId]
    );
    return this.findById(id, salonId);
  }

  static async findById(id, salonId) {
    return queryOne(JOIN + ' WHERE a.id = ? AND a."salonId" = ?', [id, salonId]);
  }

  static async getAll(filters = {}, salonId) {
    let sql = JOIN + ' WHERE a."salonId" = ?';
    const params = [salonId];
    if (filters.clienteId) { sql += ' AND a."clienteId" = ?'; params.push(filters.clienteId); }
    if (filters.servicoId) { sql += ' AND a."servicoId" = ?'; params.push(filters.servicoId); }
    if (filters.profissionalId) { sql += ' AND a."profissionalId" = ?'; params.push(filters.profissionalId); }
    if (filters.status) { sql += ' AND a.status = ?'; params.push(filters.status); }
    if (filters.data) { sql += ' AND a."dataHora"::date = ?::date'; params.push(filters.data); }
    if (filters.dataInicio && filters.dataFim) { sql += ' AND a."dataHora"::date BETWEEN ?::date AND ?::date'; params.push(filters.dataInicio, filters.dataFim); }
    sql += ' ORDER BY a."dataHora" ASC';
    return query(sql, params);
  }

  static async update(id, data, salonId) {
    const fields = [], values = [];
    const allowed = ['clienteId','servicoId','profissionalId','auxiliarId','dataHora','duracao','status','observacoes','atendimentoId'];
    for (const [k,v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(v); }
    }
    if (!fields.length) return this.findById(id, salonId);
    fields.push('"updatedAt" = NOW()');
    values.push(id, salonId);
    await queryRun(`UPDATE agendamentos SET ${fields.join(', ')} WHERE id = ? AND "salonId" = ?`, values);
    return this.findById(id, salonId);
  }

  static async delete(id, salonId) {
    return queryRun('DELETE FROM agendamentos WHERE id = ? AND "salonId" = ?', [id, salonId]);
  }

  static async getProximos(dias = 7, salonId) {
    return query(
      JOIN + ` WHERE a."salonId" = ? AND a."dataHora" >= NOW() AND a."dataHora" <= NOW() + (? || ' days')::INTERVAL AND a.status = 'agendado' ORDER BY a."dataHora" ASC`,
      [salonId, parseInt(dias)]
    );
  }

  static async getPendentesConversao(salonId) {
    return query(JOIN + ` WHERE a."salonId" = ? AND a."dataHora"::timestamptz <= NOW() AND a.status = 'agendado' ORDER BY a."dataHora" ASC`, [salonId]);
  }

  static async verificarDisponibilidade(profissionalId, dataHora, duracao, salonId) {
    const dur = parseInt(duracao) || 30;
    const conflitos = await query(`
      SELECT a.id, a."dataHora", COALESCE(s.duracao, 30) as duracao, s.nome as "servicoNome"
      FROM agendamentos a
      LEFT JOIN servicos s ON a."servicoId" = s.id
      WHERE a."profissionalId" = ?
        AND a."salonId" = ?
        AND a.status NOT IN ('cancelado', 'convertido')
        AND a."dataHora"::timestamptz < (?::timestamptz + INTERVAL '1 minute' * ?)
        AND (a."dataHora"::timestamptz + INTERVAL '1 minute' * COALESCE(s.duracao, 30)) > ?::timestamptz
    `, [profissionalId, salonId, dataHora, dur, dataHora]);
    if (conflitos.length > 0) return { disponivel: false, conflito: conflitos[0] };
    return { disponivel: true };
  }

  static async proximoHorarioVago(profissionalId, dataHoraPreferida, duracao, salonId) {
    const dur = parseInt(duracao) || 30;
    let tentativa = new Date(dataHoraPreferida);
    for (let i = 0; i < 20; i++) {
      const resultado = await this.verificarDisponibilidade(profissionalId, tentativa.toISOString(), dur, salonId);
      if (resultado.disponivel) return tentativa.toISOString();
      const fimConflito = new Date(
        new Date(resultado.conflito.dataHora).getTime() + (resultado.conflito.duracao || 30) * 60000
      );
      tentativa = fimConflito;
    }
    return null;
  }

  static async converterParaAtendimento(id, salonId) {
    const agendamento = await this.findById(id, salonId);
    if (!agendamento) return null;
    const Atendimento = require('./Atendimento');
    const horaInicio = new Date(agendamento.dataHora);
    const horaFim = new Date(horaInicio.getTime() + (agendamento.servicoDuracao||30)*60000);
    const atendimento = await Atendimento.create({
      clienteId: agendamento.clienteId, profissionalId: agendamento.profissionalId,
      auxiliarId: agendamento.auxiliarId||null,
      data: new Date(agendamento.dataHora).toISOString().split('T')[0],
      horaInicio: horaInicio.toTimeString().slice(0,5), horaFim: horaFim.toTimeString().slice(0,5),
      desconto: 0, observacoes: `Convertido do agendamento: ${agendamento.observacoes||''}`,
      totalProdutos: 0, totalServicos: agendamento.servicoPreco, totalGeral: agendamento.servicoPreco,
    }, [], [{
      servicoId: agendamento.servicoId, horaInicio: horaInicio.toTimeString().slice(0,5),
      horaFim: horaFim.toTimeString().slice(0,5), preco: agendamento.servicoPreco, duracao: agendamento.servicoDuracao||30
    }], salonId);
    await this.update(id, { status: 'convertido', atendimentoId: atendimento.id }, salonId);
    return { agendamento, atendimento };
  }
}

module.exports = Agendamento;
