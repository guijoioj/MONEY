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
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      `SELECT cc.* FROM creditos_cliente cc
       JOIN clientes c ON c.id = cc.cliente_id
       WHERE cc.id = $1 AND c.salao_id = $2`,
      [req.params.id, req.salaoId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Crédito não encontrado' });
    await pool.query('DELETE FROM creditos_cliente WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { id: req.params.id } });
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
