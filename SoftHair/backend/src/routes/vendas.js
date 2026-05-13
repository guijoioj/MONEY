const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { query, queryOne, queryRun, withTransaction } = require('../config/database');

// P2-A2 (E28): valida `:id` numérico.
router.param('id', validateId);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, tipo, data_inicio, data_fim, clienteId } = req.query;
    const params = [req.salaoId];
    let sql = `
      SELECT v.*, c.nome as cliente_nome, p.nome as profissional_nome
      FROM vendas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN profissionais p ON p.id = v.profissional_id
      WHERE v.salao_id = ?
    `;
    if (status) { sql += ` AND v.status = ?`; params.push(status); }
    if (tipo) { sql += ` AND v.tipo = ?`; params.push(tipo); }
    if (clienteId) { sql += ` AND v.cliente_id = ?`; params.push(clienteId); }
    if (data_inicio && data_fim) {
      sql += ` AND date(v.created_at) BETWEEN ? AND ?`;
      params.push(data_inicio, data_fim);
    }
    sql += ` ORDER BY v.created_at DESC LIMIT 500`;
    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const venda = await queryOne(
      `SELECT v.*, c.nome as cliente_nome, p.nome as profissional_nome
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       LEFT JOIN profissionais p ON p.id = v.profissional_id
       WHERE v.id = ? AND v.salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!venda) return res.status(404).json({ success: false, error: 'Venda não encontrada' });

    const itens = await query(
      `SELECT vi.*, pr.nome as produto_nome
       FROM venda_itens vi
       LEFT JOIN produtos pr ON pr.id = vi.produto_id
       WHERE vi.venda_id = ?`,
      [req.params.id]
    );
    venda.itens = itens;
    res.json({ success: true, data: venda });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('tipo').isIn(['servico', 'produto', 'misto']).withMessage('Tipo deve ser servico, produto ou misto'),
  body('valor_total').isFloat({ min: 0 }).withMessage('Valor total deve ser positivo'),
  body('valor_final').isFloat({ min: 0 }).withMessage('Valor final deve ser positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await withTransaction(async (client) => {
      const { cliente_id, profissional_id, tipo, status, valor_total, desconto, valor_final, forma_pagamento, observacoes, itens } = req.body;
      const insertVenda = await client.query(
        `INSERT INTO vendas (salao_id, cliente_id, profissional_id, tipo, status, valor_total, desconto, valor_final, forma_pagamento, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.salaoId, cliente_id || null, profissional_id || null,
          tipo, status || 'pendente',
          valor_total, desconto || 0, valor_final,
          forma_pagamento || null, observacoes || null,
        ]
      );
      const vendaId = insertVenda.lastInsertRowid;

      if (itens && Array.isArray(itens)) {
        for (const item of itens) {
          await client.query(
            `INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, valor_total)
             VALUES (?, ?, ?, ?, ?)`,
            [vendaId, item.produto_id, item.quantidade, item.preco_unitario, item.quantidade * item.preco_unitario]
          );
          await client.query(
            `UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?`,
            [item.quantidade, item.produto_id]
          );
        }
      }

      const venda = await client.query(`SELECT * FROM vendas WHERE id = ?`, [vendaId]);
      return venda.rows[0] || { id: vendaId };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await queryOne(
      `SELECT * FROM vendas WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!existing) return res.status(404).json({ success: false, error: 'Venda não encontrada' });

    const fields = ['status', 'forma_pagamento', 'observacoes'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.json({ success: true, data: existing });

    updates.push(`updated_at = datetime('now')`);
    params.push(req.params.id, req.salaoId);

    await queryRun(
      `UPDATE vendas SET ${updates.join(', ')} WHERE id = ? AND salao_id = ?`,
      params
    );
    const data = await queryOne(`SELECT * FROM vendas WHERE id = ?`, [req.params.id]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await withTransaction(async (client) => {
      const update = await client.query(
        `UPDATE vendas SET status = 'cancelada', updated_at = datetime('now') WHERE id = ? AND salao_id = ? AND status != 'cancelada'`,
        [req.params.id, req.salaoId]
      );
      if (update.rowCount === 0) return { canceled: false };
      // Restaurar estoque
      const itens = await client.query(`SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = ?`, [req.params.id]);
      for (const item of itens.rows) {
        await client.query(
          `UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?`,
          [item.quantidade, item.produto_id]
        );
      }
      return { canceled: true };
    });
    if (!result.canceled) return res.status(404).json({ success: false, error: 'Venda não encontrada ou já cancelada' });
    res.json({ success: true, message: 'Venda cancelada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
