const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { FechamentoService } = require('../services');

const service = new FechamentoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, tipo } = req.query;
    const result = await service.listar(req.salaoId, { status, tipo });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fechamentos em aberto: lista atendimentos finalizados ainda não fechados (agrupados por cliente)
router.get('/em-aberto', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { profissionalId, clienteId } = req.query;

    const params = [req.salaoId];
    let where = `a.salao_id = $1 AND a.status = 'finalizado' AND NOT EXISTS (
      SELECT 1 FROM fechamentos f WHERE f.salao_id = a.salao_id
        AND f.cliente_id = a.cliente_id
        AND a.created_at::date BETWEEN f.data_inicio AND f.data_fim
    )`;
    let p = 2;
    if (profissionalId) { where += ` AND a.profissional_id = $${p++}`; params.push(profissionalId); }
    if (clienteId) { where += ` AND a.cliente_id = $${p++}`; params.push(clienteId); }

    const { rows } = await pool.query(`
      SELECT a.*, c.nome as cliente_nome, p.nome as profissional_nome, s.nome as servico_nome
      FROM atendimentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN profissionais p ON p.id = a.profissional_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE ${where}
      ORDER BY a.created_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('data_inicio').isDate().withMessage('data_inicio obrigatória (YYYY-MM-DD)'),
  body('data_fim').isDate().withMessage('data_fim obrigatória (YYYY-MM-DD)'),
  body('tipo').optional().isIn(['diario', 'semanal', 'mensal']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.gerar(req.salaoId, req.body.data_inicio, req.body.data_fim, req.body.tipo);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/reabrir', authMiddleware, async (req, res) => {
  try {
    const result = await service.reabrir(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      'SELECT id FROM fechamentos WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fechamento não encontrado' });
    }
    await pool.query('DELETE FROM fechamentos WHERE id = $1 AND salao_id = $2', [req.params.id, req.salaoId]);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
