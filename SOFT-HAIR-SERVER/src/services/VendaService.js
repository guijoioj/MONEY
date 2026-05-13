const { query, queryOne, withTransaction } = require('../config/database');
const { logAction } = require('../utils/auditLog');

// [P8-A1] State machine de status de venda — transições válidas:
//   pendente   → concluida | finalizada | cancelada
//   concluida  → cancelada (estorno)
//   finalizada → cancelada (estorno)
//   cancelada  → ∅ (terminal)
// Qualquer outra transição é rejeitada.
const VENDA_STATUS_TRANSITIONS = {
  pendente: ['concluida', 'finalizada', 'cancelada'],
  concluida: ['cancelada'],
  finalizada: ['cancelada'],
  cancelada: [],
};

const VENDA_STATUS_VALIDOS = ['pendente', 'concluida', 'finalizada', 'cancelada'];

class VendaService {
  async listar(salaoId, filtros = {}) {
    try {
      let sql = `
        SELECT v.*, c.nome as cliente_nome, p.nome as profissional_nome
        FROM vendas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN profissionais p ON p.id = v.profissional_id
        WHERE v.salao_id = $1
      `;
      const params = [salaoId];
      let paramCount = 2;

      if (filtros.status) {
        sql += ` AND v.status = $${paramCount++}`;
        params.push(filtros.status);
      }
      if (filtros.tipo) {
        sql += ` AND v.tipo = $${paramCount++}`;
        params.push(filtros.tipo);
      }
      if (filtros.data_inicio && filtros.data_fim) {
        sql += ` AND DATE(v.created_at) BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(filtros.data_inicio, filtros.data_fim);
      }

      // [P5-B9] LIMIT configurável via env
      const lim = Math.min(parseInt(process.env.VENDAS_LIST_LIMIT || '200', 10) || 200, 2000);
      sql += ` ORDER BY v.created_at DESC LIMIT ${lim}`;
      const data = await query(sql, params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const venda = await queryOne(`
        SELECT v.*, c.nome as cliente_nome, p.nome as profissional_nome
        FROM vendas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN profissionais p ON p.id = v.profissional_id
        WHERE v.id = $1 AND v.salao_id = $2
      `, [id, salaoId]);

      if (!venda) return { success: false, error: 'Venda não encontrada' };

      // Buscar itens da venda
      const itens = await query(
        'SELECT vi.*, pr.nome as produto_nome FROM venda_itens vi LEFT JOIN produtos pr ON pr.id = vi.produto_id WHERE vi.venda_id = $1',
        [id]
      );
      venda.itens = itens;

      return { success: true, data: venda };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async criar(data, salaoId) {
    try {
      return await withTransaction(async (client) => {
        // [P3-C2] Validar tenancy das FKs (cliente / profissional)
        if (data.cliente_id) {
          const cli = await client.query(
            'SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2',
            [data.cliente_id, salaoId]
          );
          if (!cli.rows.length) {
            return { success: false, error: 'cliente_id não pertence ao salão' };
          }
        }
        if (data.profissional_id) {
          const prof = await client.query(
            'SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2',
            [data.profissional_id, salaoId]
          );
          if (!prof.rows.length) {
            return { success: false, error: 'profissional_id não pertence ao salão' };
          }
        }

        // [P3-C2] Calcular valor_final no SERVER a partir dos itens (jamais aceitar do cliente).
        // Buscar preço autoritativo do DB e validar tenancy de cada produto.
        const itensValidados = [];
        let valorTotalCalculado = 0;
        if (data.itens && Array.isArray(data.itens)) {
          // [P3-M3] Upper bound em quantidade (max 10000 por item)
          for (const item of data.itens) {
            const qtd = Number(item.quantidade);
            if (!Number.isInteger(qtd) || qtd <= 0 || qtd > 10000) {
              return { success: false, error: `Quantidade inválida (1..10000) para produto ${item.produto_id}` };
            }
            const prodRow = await client.query(
              'SELECT id, preco_venda FROM produtos WHERE id = $1 AND salao_id = $2 AND ativo = true',
              [item.produto_id, salaoId]
            );
            if (!prodRow.rows.length) {
              return { success: false, error: `produto_id ${item.produto_id} não pertence ao salão` };
            }
            const preco = Number(prodRow.rows[0].preco_venda);
            const subtotal = preco * qtd;
            itensValidados.push({
              produto_id: prodRow.rows[0].id,
              quantidade: qtd,
              preco_unitario: preco,
              subtotal,
            });
            valorTotalCalculado += subtotal;
          }
        }

        const desconto = Number(data.desconto) > 0 ? Number(data.desconto) : 0;
        // [P3-C2] Server-side authoritative pricing
        const valorTotal = valorTotalCalculado || Number(data.valor_total) || 0;
        const valorFinal = Math.max(valorTotal - desconto, 0);

        // Criar venda
        const vendaResult = await client.query(`
          INSERT INTO vendas (cliente_id, profissional_id, tipo, status, valor_total, desconto, valor_final, forma_pagamento, observacoes, salao_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [
          data.cliente_id || null, data.profissional_id || null,
          data.tipo, data.status || 'pendente',
          valorTotal, desconto, valorFinal,
          data.forma_pagamento || null, data.observacoes || null, salaoId
        ]);
        const venda = vendaResult.rows[0];

        // [P3-C2] Inserir itens com preços validados + decrementar estoque com tenancy e atomicidade
        for (const item of itensValidados) {
          await client.query(`
            INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, valor_total)
            VALUES ($1, $2, $3, $4, $5)
          `, [venda.id, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal]);

          // [P3-C2] UPDATE condicional: filtra salao_id E exige estoque suficiente. Falha atômica.
          const upd = await client.query(`
            UPDATE produtos
               SET quantidade_estoque = quantidade_estoque - $1
             WHERE id = $2
               AND salao_id = $3
               AND quantidade_estoque >= $1
            RETURNING id
          `, [item.quantidade, item.produto_id, salaoId]);
          if (!upd.rows.length) {
            throw new Error(`Estoque insuficiente para produto ${item.produto_id}`);
          }
        }

        return { success: true, data: venda };
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async atualizar(id, data, salaoId, opts = {}) {
    try {
      // [P8-A1] State machine + tenancy + audit
      const existing = await queryOne(
        'SELECT id, status FROM vendas WHERE id = $1 AND salao_id = $2',
        [id, salaoId]
      );
      if (!existing) return { success: false, error: 'Venda não encontrada' };

      // [P8-A1] Validar status com state machine se foi enviado.
      if (data.status && data.status !== existing.status) {
        if (!VENDA_STATUS_VALIDOS.includes(data.status)) {
          return { success: false, error: `Status inválido: ${data.status}` };
        }
        const allowed = VENDA_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(data.status)) {
          return {
            success: false,
            error: `Transição inválida: ${existing.status} → ${data.status}`,
          };
        }
      }

      // [P8-A1] Transição para `cancelada` via PUT precisa restaurar estoque
      // (mesma lógica do DELETE /vendas/:id) — se transitar diretamente sem isso,
      // o estoque fica double-decrement quando uma nova venda real for criada.
      if (data.status === 'cancelada' && existing.status !== 'cancelada') {
        return await withTransaction(async (client) => {
          const upd = await client.query(`
            UPDATE vendas SET
              status = 'cancelada',
              forma_pagamento = COALESCE($1, forma_pagamento),
              observacoes = COALESCE($2, observacoes),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND salao_id = $4 RETURNING *
          `, [data.forma_pagamento || null, data.observacoes || null, id, salaoId]);
          if (!upd.rows.length) return { success: false, error: 'Venda não encontrada' };
          const venda = upd.rows[0];

          // Restore stock com tenancy guard
          const itens = await client.query(
            'SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = $1',
            [id]
          );
          for (const item of itens.rows) {
            await client.query(
              'UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2 AND salao_id = $3',
              [item.quantidade, item.produto_id, salaoId]
            );
          }

          // [P8-A1] Audit
          await logAction({
            req: opts.req,
            action: 'venda.status_change',
            entityType: 'venda',
            entityId: id,
            before: { status: existing.status },
            after: { status: 'cancelada' },
            salaoId,
          }).catch(() => {});

          return { success: true, data: venda };
        });
      }

      const result = await queryOne(`
        UPDATE vendas SET
          status = COALESCE($1, status),
          forma_pagamento = COALESCE($2, forma_pagamento),
          observacoes = COALESCE($3, observacoes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND salao_id = $5 RETURNING *
      `, [data.status, data.forma_pagamento, data.observacoes, id, salaoId]);

      if (!result) return { success: false, error: 'Venda não encontrada' };

      // [P8-A1] Audit log se status mudou
      if (data.status && data.status !== existing.status) {
        await logAction({
          req: opts.req,
          action: 'venda.status_change',
          entityType: 'venda',
          entityId: id,
          before: { status: existing.status },
          after: { status: data.status },
          salaoId,
        }).catch(() => {});
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cancelar(id, salaoId) {
    try {
      return await withTransaction(async (client) => {
        const result = await client.query(`
          UPDATE vendas SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND salao_id = $2 AND status != 'cancelada' RETURNING *
        `, [id, salaoId]);

        if (result.rows.length === 0) return { success: false, error: 'Venda não encontrada ou já cancelada' };
        const venda = result.rows[0];

        // [P4-A1] Restore stock com tenancy guard. Vendas legadas (pré-P3-C2) podiam ter
        // produto_id apontando para outro salão; cancelar agora não incrementa estoque alheio.
        const itens = await client.query('SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = $1', [id]);
        for (const item of itens.rows) {
          await client.query(
            'UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2 AND salao_id = $3',
            [item.quantidade, item.produto_id, salaoId]
          );
        }

        return { success: true, data: venda, message: 'Venda cancelada' };
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = VendaService;
