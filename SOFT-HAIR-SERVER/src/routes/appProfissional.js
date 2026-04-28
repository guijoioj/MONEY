const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');

const TIPOS_PONTO = ['entrada', 'saida', 'pausa', 'retorno_pausa', 'inicio_atendimento', 'fim_atendimento'];

// GET /ponto
router.get('/ponto', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM registros_ponto WHERE profissional_id = $1 AND DATE(created_at) = CURRENT_DATE ORDER BY created_at`,
      [req.profissionalId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar ponto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /ponto
router.post('/ponto', [
  body('tipo').isIn(TIPOS_PONTO).withMessage('Tipo inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const result = await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, $3) RETURNING *`,
      [req.profissionalId, req.salaoId, req.body.tipo]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar ponto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /agenda
router.get('/agenda', async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, s.nome as servico_nome
       FROM agendamentos a
       LEFT JOIN clientes c ON c.id = a.cliente_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.profissional_id = $1 AND a.data_agendamento = $2
       ORDER BY a.hora_agendamento`,
      [req.profissionalId, data]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /atendimentos
router.get('/atendimentos', async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT at.*, c.nome as cliente_nome, s.nome as servico_nome
       FROM atendimentos at
       LEFT JOIN clientes c ON c.id = at.cliente_id
       LEFT JOIN servicos s ON s.id = at.servico_id
       WHERE at.profissional_id = $1 AND DATE(at.created_at) = $2::date
       ORDER BY at.created_at DESC`,
      [req.profissionalId, data]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar atendimentos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /comissoes
router.get('/comissoes', async (req, res) => {
  try {
    const hoje = new Date();
    const defaultInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

    const data_inicio = req.query.data_inicio || defaultInicio;
    const data_fim = req.query.data_fim || defaultFim;

    const result = await pool.query(
      `SELECT * FROM comissoes WHERE profissional_id = $1 AND data BETWEEN $2 AND $3 ORDER BY data DESC`,
      [req.profissionalId, data_inicio, data_fim]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar comissões:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /produtos-utilizados
router.post('/produtos-utilizados', [
  body('marca').notEmpty().withMessage('Marca é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { marca, coloracao, quantidade, cliente_id, cliente_nome, observacoes } = req.body;
    const result = await pool.query(
      `INSERT INTO produtos_utilizados (profissional_id, salao_id, cliente_id, cliente_nome, marca, coloracao, quantidade, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.profissionalId, req.salaoId, cliente_id || null, cliente_nome || null, marca, coloracao || null, quantidade || 1, observacoes || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar produto utilizado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /produtos-utilizados
router.get('/produtos-utilizados', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM produtos_utilizados WHERE profissional_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.profissionalId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao listar produtos utilizados:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
