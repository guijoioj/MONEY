const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { CreditoService } = require('../services');

const service = new CreditoService();

// Listar todas as movimentações do salão
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { clienteId } = req.query;
    const params = [req.salaoId];
    let extra = '';
    if (clienteId) { extra = ' AND cc.cliente_id = $2'; params.push(clienteId); }
    const { rows } = await pool.query(`
      SELECT cc.*, c.nome AS cliente_nome
      FROM creditos_cliente cc
      JOIN clientes c ON c.id = cc.cliente_id
      WHERE c.salao_id = $1${extra}
      ORDER BY cc.created_at DESC
    `, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Saldo de um cliente
router.get('/saldo/:clienteId', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      'SELECT id, nome, credito_disponivel FROM clientes WHERE id = $1 AND salao_id = $2',
      [req.params.clienteId, req.salaoId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    const c = rows[0];
    res.json({ success: true, data: { id: c.id, nome: c.nome, saldo: parseFloat(c.credito_disponivel) || 0 } });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Todos os clientes com saldo > 0
router.get('/todos-com-saldo', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      `SELECT id, nome, telefone, credito_disponivel AS saldo
       FROM clientes
       WHERE salao_id = $1 AND COALESCE(credito_disponivel, 0) > 0
       ORDER BY credito_disponivel DESC`,
      [req.salaoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Remover lançamento de crédito (estorno)
// [P3-A6] DELETE recompõe saldo do cliente em transação atômica, evitando fraude interna
// (admin que apagava lançamentos sem ajustar saldo). Audit log gravado.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { withTransaction } = require('../config/database');
    const result = await withTransaction(async (client) => {
      // Buscar lançamento + cliente, validando tenancy
      const found = await client.query(
        `SELECT cc.*, c.salao_id AS cliente_salao_id, c.credito_disponivel
           FROM creditos_cliente cc
           JOIN clientes c ON c.id = cc.cliente_id
          WHERE cc.id = $1 AND c.salao_id = $2
          FOR UPDATE`,
        [req.params.id, req.salaoId]
      );
      if (found.rows.length === 0) {
        return { code: 404, body: { success: false, error: 'Crédito não encontrado' } };
      }
      const mov = found.rows[0];

      // [P3-A6] Recompor saldo: reverter o efeito da movimentação.
      // tipo='credito' adicionou X → ao deletar, subtrair X.
      // tipo='uso' subtraiu X → ao deletar, adicionar X.
      const valor = Number(mov.valor) || 0;
      const delta = mov.tipo === 'credito' ? -valor : (mov.tipo === 'uso' ? +valor : 0);

      await client.query('DELETE FROM creditos_cliente WHERE id = $1', [req.params.id]);

      if (delta !== 0) {
        await client.query(
          `UPDATE clientes SET credito_disponivel = COALESCE(credito_disponivel, 0) + $1,
                               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND salao_id = $3`,
          [delta, mov.cliente_id, req.salaoId]
        );
      }

      // [P3-A6] Audit log do estorno
      console.log(`[CREDITOS][AUDIT][DELETE] salao=${req.salaoId} user=${req.user?.userId} mov=${mov.id} cliente=${mov.cliente_id} tipo=${mov.tipo} valor=${valor} delta=${delta}`);

      return { code: 200, body: { success: true, data: { id: req.params.id, saldoAjustado: delta } } };
    });
    return res.status(result.code).json(result.body);
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/cliente/:clienteId', authMiddleware, async (req, res) => {
  try {
    const result = await service.listarPorCliente(req.params.clienteId, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id obrigatório'),
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser positivo'),
  body('tipo').isIn(['credito', 'uso']).withMessage('Tipo deve ser credito ou uso'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { cliente_id, valor, tipo, observacoes } = req.body;
    const result = await service.adicionar(cliente_id, valor, tipo, observacoes, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data, message: result.message });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
