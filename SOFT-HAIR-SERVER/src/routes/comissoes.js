const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { ComissaoService } = require('../services');

const service = new ComissaoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { profissional_id, pago, data_inicio, data_fim } = req.query;
    const result = await service.listar(req.salaoId, { profissional_id, pago, data_inicio, data_fim });
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Comissões pagas
router.get('/pagas', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      `SELECT cp.*, p.nome AS profissional_nome
       FROM comissoes_pagas cp
       LEFT JOIN profissionais p ON p.id = cp.profissional_id
       WHERE cp.salao_id = $1
       ORDER BY cp.created_at DESC`,
      [req.salaoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    // tabela pode não existir — devolve lista vazia em vez de 500
    res.json({ success: true, data: [] });
  }
});

// Comissões estornadas
router.get('/estornos', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      `SELECT ce.*, p.nome AS profissional_nome
       FROM comissoes_estornos ce
       LEFT JOIN profissionais p ON p.id = ce.profissional_id
       WHERE ce.salao_id = $1
       ORDER BY ce.created_at DESC`,
      [req.salaoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// Pagar comissões (em lote)
router.post('/pagar', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { profissional_id, profissionalId, valor, observacoes, comissoes } = req.body;
    const pid = profissional_id || profissionalId;
    if (!pid || !valor) {
      return res.status(400).json({ success: false, error: 'profissional_id e valor obrigatórios' });
    }
    const { rows } = await pool.query(
      `INSERT INTO comissoes_pagas (salao_id, profissional_id, valor, observacoes, comissoes_ids)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.salaoId, pid, valor, observacoes || null, comissoes || null]
    );
    if (Array.isArray(comissoes) && comissoes.length > 0) {
      await pool.query(
        `UPDATE comissoes SET pago = true WHERE id = ANY($1::int[]) AND salao_id = $2`,
        [comissoes, req.salaoId]
      );
    }
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Estornar comissão
router.post('/estornar', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { fechamento_id, fechamentoId, motivo, valor, profissional_id, profissionalId } = req.body;
    const fid = fechamento_id || fechamentoId;
    const pid = profissional_id || profissionalId;
    const { rows } = await pool.query(
      `INSERT INTO comissoes_estornos (salao_id, fechamento_id, profissional_id, valor, motivo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.salaoId, fid || null, pid || null, valor || 0, motivo || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/resumo/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ success: false, error: 'data_inicio e data_fim obrigatórios' });
    const result = await service.resumoPorProfissional(req.salaoId, req.params.profissionalId, data_inicio, data_fim);
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const result = await service.criar(req.body, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.put('/:id/pagar', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarComoPaga(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data, message: result.message });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
