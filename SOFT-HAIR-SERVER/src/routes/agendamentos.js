const express = require('express');
const router = express.Router();
const { body, query: queryValidator, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { AgendamentoService } = require('../services');

const service = new AgendamentoService();

// Listar agendamentos (com filtros)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, data_inicio, data_fim, cliente_id, profissional_id } = req.query;
    const result = await service.listar(req.salaoId, { status, data_inicio, data_fim, cliente_id, profissional_id });

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar agendamento
router.post('/', authMiddleware, [
  body('cliente_id').isInt().withMessage('cliente_id é obrigatório'),
  body('servico_id').isInt().withMessage('servico_id é obrigatório'),
  body('data_hora').isISO8601().withMessage('data_hora deve ser ISO 8601'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const result = await service.criar(req.body, req.salaoId);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar agendamento
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.atualizar(req.params.id, req.body, req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancelar agendamento
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Horários disponíveis
router.get('/disponiveis/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) return res.status(400).json({ success: false, error: 'Parâmetro "data" é obrigatório' });
    const result = await service.getHorariosDisponiveis(req.params.profissionalId, data, req.salaoId);
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
