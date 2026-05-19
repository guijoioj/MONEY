const { query, queryOne, withTransaction, pool } = require('../config/database');
const { logAction } = require('../utils/auditLog');
const CommissionTriggers = require('./CommissionTriggers');

// [P8-A2] State machine de status de atendimento — transições válidas:
//   agendado     → em_andamento | cancelado
//   em_andamento → finalizado | cancelado
//   finalizado   → ∅ (terminal — não pode voltar nem cancelar)
//   cancelado    → ∅ (terminal)
const ATEND_STATUS_TRANSITIONS = {
  agendado: ['em_andamento', 'cancelado'],
  em_andamento: ['finalizado', 'cancelado'],
  finalizado: [],
  cancelado: [],
};

const ATEND_STATUS_VALIDOS = ['agendado', 'em_andamento', 'finalizado', 'cancelado'];

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
      // [P4-A2] Validar tenancy de TODAS as FKs antes do INSERT — impede que cliente/profissional/serviço/agendamento
      // de outro salão sejam referenciados (cross-tenant FK injection).
      if (data.cliente_id) {
        const ok = await queryOne('SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2', [data.cliente_id, salaoId]);
        if (!ok) return { success: false, error: 'Cliente não pertence ao salão' };
      }
      if (data.profissional_id) {
        const ok = await queryOne('SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2', [data.profissional_id, salaoId]);
        if (!ok) return { success: false, error: 'Profissional não pertence ao salão' };
      }
      if (data.agendamento_id) {
        const ok = await queryOne('SELECT 1 FROM agendamentos WHERE id = $1 AND salao_id = $2', [data.agendamento_id, salaoId]);
        if (!ok) return { success: false, error: 'Agendamento não pertence ao salão' };
      }

      // [P4-A2/P4-A3] `valor` agora é AUTORITATIVO via servicos.preco quando há servico_id;
      // payload da rota não pode inflacionar/zerar receita ou comissão downstream.
      let valorAutoritativo = Number(data.valor) || 0;
      if (data.servico_id) {
        const srv = await queryOne('SELECT preco FROM servicos WHERE id = $1 AND salao_id = $2', [data.servico_id, salaoId]);
        if (!srv) return { success: false, error: 'Serviço não pertence ao salão' };
        valorAutoritativo = Number(srv.preco) || 0;
      }

      const result = await queryOne(`
        INSERT INTO atendimentos (cliente_id, profissional_id, servico_id, agendamento_id, valor, status, observacoes, salao_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [data.cliente_id, data.profissional_id, data.servico_id, data.agendamento_id || null,
          valorAutoritativo, data.status || 'em_andamento', data.observacoes || null, salaoId]);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async atualizar(id, data, salaoId, opts = {}) {
    try {
      // [P4-A3] Recupera estado atual — necessário para validar transição e re-derivar valor de servico.preco.
      const existing = await queryOne('SELECT id, status, servico_id FROM atendimentos WHERE id = $1 AND salao_id = $2', [id, salaoId]);
      if (!existing) return { success: false, error: 'Atendimento não encontrado' };

      // [P8-A2] State machine de status. Bloqueia transições inválidas
      // (`finalizado → qualquer`, `cancelado → qualquer`, etc.)
      if (data.status && data.status !== existing.status) {
        if (!ATEND_STATUS_VALIDOS.includes(data.status)) {
          return { success: false, error: `Status inválido: ${data.status}` };
        }
        const allowed = ATEND_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(data.status)) {
          return {
            success: false,
            error: `Transição inválida: ${existing.status} → ${data.status}`,
          };
        }
      }

      // [P8-A2] Atendimento em estado terminal (finalizado/cancelado) NÃO aceita
      // updates de campos não-status — bloqueia "patch" silencioso de observacoes
      // em registros financeiros consolidados.
      const terminal = existing.status === 'finalizado' || existing.status === 'cancelado';
      const tentandoMudarStatus = !!data.status && data.status !== existing.status;
      if (terminal && !tentandoMudarStatus) {
        // Não tem transição válida — bloqueia qualquer modificação
        return {
          success: false,
          error: `Atendimento em estado ${existing.status} é imutável`,
        };
      }

      // [P4-A3] BLOQUEAR alteração de `valor` arbitrariamente. Se o caller insistir em mandar `valor`,
      // ignoramos o payload e re-derivamos do `servicos.preco`. Após finalizado, valor é READ-ONLY.
      // Isso bloqueia inflação de comissão downstream.
      const result = await queryOne(`
        UPDATE atendimentos SET
          status = COALESCE($1, status),
          observacoes = COALESCE($2, observacoes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND salao_id = $4 RETURNING *
      `, [data.status, data.observacoes, id, salaoId]);

      // [P8-A2] Audit log se status mudou
      if (data.status && data.status !== existing.status) {
        await logAction({
          req: opts.req,
          action: 'atendimento.status_change',
          entityType: 'atendimento',
          entityId: id,
          before: { status: existing.status },
          after: { status: data.status },
          salaoId,
        }).catch(() => {});

        // [V2] Atendimento finalizado → gera comissões automaticamente
        if (data.status === 'finalizado') {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const trig = await CommissionTriggers.onAtendimentoFechado(result, client);
            await client.query('COMMIT');
            if (!trig.ok) {
              console.warn('[AtendimentoService] trigger comissão falhou:', trig.error);
            } else {
              result._comissoes_geradas = trig.inserted;
            }
          } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            console.warn('[AtendimentoService] trigger transaction rollback:', e.message);
          } finally {
            client.release();
          }
        }
      }

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
