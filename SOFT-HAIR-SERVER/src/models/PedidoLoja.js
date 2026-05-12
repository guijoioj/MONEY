const { query, queryOne, withTransaction } = require('../config/database');

// [P9-M1] State machine de status de pedido_loja — transições válidas:
//   pendente   → confirmado | cancelado
//   confirmado → preparando | cancelado
//   preparando → enviado | cancelado
//   enviado    → entregue (não pode voltar nem cancelar — já saiu)
//   entregue   → ∅ (terminal)
//   cancelado  → ∅ (terminal)
const PEDIDO_STATUS_TRANSITIONS = {
  pendente: ['confirmado', 'cancelado'],
  confirmado: ['preparando', 'cancelado'],
  preparando: ['enviado', 'cancelado'],
  enviado: ['entregue'],
  entregue: [],
  cancelado: [],
};

const PEDIDO_STATUS_VALIDOS = ['pendente', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'];

function toShape(row) {
  if (!row) return null;
  return {
    ...row,
    salonId: row.salao_id,
    clienteAppId: row.cliente_app_id,
    enderecoEntrega: row.endereco_entrega,
    formaPagamento: row.forma_pagamento,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class PedidoLoja {
  static async create(data, itens) {
    const pedido = await withTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO pedidos_loja (salao_id, cliente_app_id, status, total, endereco_entrega, forma_pagamento, observacoes)
        VALUES ($1, $2, 'pendente', $3, $4, $5, $6)
        RETURNING *
      `, [
        data.salao_id || data.salonId,
        data.cliente_app_id || data.clienteAppId,
        data.total,
        data.endereco_entrega || data.enderecoEntrega || null,
        data.forma_pagamento || data.formaPagamento || null,
        data.observacoes || null
      ]);
      const pedidoRow = result.rows[0];

      for (const item of itens) {
        await client.query(`
          INSERT INTO pedido_loja_itens (pedido_id, produto_id, quantidade, preco_unitario, subtotal)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          pedidoRow.id,
          item.produto_id || item.produtoId,
          item.quantidade,
          item.preco_unitario || item.precoUnitario,
          item.subtotal
        ]);
      }

      return pedidoRow;
    });

    return this.findById(pedido.id);
  }

  static async findById(id) {
    const pedido = toShape(await queryOne(`
      SELECT pl.*, ca.nome as "clienteNome", ca.telefone as "clienteTelefone", sl.nome as "salaoNome"
      FROM pedidos_loja pl
      LEFT JOIN clientes ca ON pl.cliente_app_id = ca.id
      LEFT JOIN saloes sl ON pl.salao_id = sl.id
      WHERE pl.id = $1
    `, [id]));
    if (!pedido) return null;
    pedido.itens = await query(`
      SELECT pli.*, p.nome as "produtoNome"
      FROM pedido_loja_itens pli
      LEFT JOIN produtos p ON pli.produto_id = p.id
      WHERE pli.pedido_id = $1
    `, [id]);
    return pedido;
  }

  static async getByCliente(clienteAppId) {
    const pedidos = (await query(`
      SELECT pl.*, sl.nome as "salaoNome"
      FROM pedidos_loja pl
      LEFT JOIN saloes sl ON pl.salao_id = sl.id
      WHERE pl.cliente_app_id = $1
      ORDER BY pl.created_at DESC
    `, [clienteAppId])).map(toShape);
    for (const pedido of pedidos) {
      pedido.itens = await query(`
        SELECT pli.*, pr.nome as "produtoNome"
        FROM pedido_loja_itens pli
        LEFT JOIN produtos pr ON pli.produto_id = pr.id
        WHERE pli.pedido_id = $1
      `, [pedido.id]);
    }
    return pedidos;
  }

  static async getBySalao(salaoId, filters = {}) {
    const params = [salaoId];
    let idx = 2;
    let sql = `
      SELECT pl.*, ca.nome as "clienteNome", ca.telefone as "clienteTelefone"
      FROM pedidos_loja pl
      LEFT JOIN clientes ca ON pl.cliente_app_id = ca.id
      WHERE pl.salao_id = $1
    `;
    if (filters.status) {
      sql += ` AND pl.status = $${idx++}`;
      params.push(filters.status);
    }
    sql += ' ORDER BY pl.created_at DESC';
    const pedidos = (await query(sql, params)).map(toShape);
    for (const pedido of pedidos) {
      pedido.itens = await query(`
        SELECT pli.*, pr.nome as "produtoNome"
        FROM pedido_loja_itens pli
        LEFT JOIN produtos pr ON pli.produto_id = pr.id
        WHERE pli.pedido_id = $1
      `, [pedido.id]);
    }
    return pedidos;
  }

  static async atualizarStatus(id, salaoId, status) {
    // [P9-M1] State machine enforcement. Lê estado atual e valida transição.
    const existing = await queryOne(
      'SELECT id, status FROM pedidos_loja WHERE id = $1 AND salao_id = $2',
      [id, salaoId]
    );
    if (!existing) {
      const err = new Error('Pedido não encontrado');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!PEDIDO_STATUS_VALIDOS.includes(status)) {
      const err = new Error(`Status inválido: ${status}`);
      err.code = 'INVALID_STATUS';
      throw err;
    }

    if (status !== existing.status) {
      const allowed = PEDIDO_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(status)) {
        const err = new Error(`Transição inválida: ${existing.status} → ${status}`);
        err.code = 'INVALID_TRANSITION';
        err.before = existing.status;
        err.after = status;
        throw err;
      }
    }

    await query(`
      UPDATE pedidos_loja
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND salao_id = $3
    `, [status, id, salaoId]);

    const updated = await this.findById(id);
    // Anexar before para que o route possa registrar audit log
    if (updated) updated._previousStatus = existing.status;
    return updated;
  }
}

module.exports = PedidoLoja;
