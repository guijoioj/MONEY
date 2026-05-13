const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { query, queryOne, queryRun } = require('../config/database');

// P2-A2 (E28): valida `:id` numérico.
router.param('id', validateId);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, ativo } = req.query;
    const params = [req.salaoId];
    let sql = `SELECT * FROM profissionais WHERE salao_id = ?`;
    if (ativo !== undefined) {
      sql += ` AND ativo = ?`;
      params.push(ativo === 'true' ? 1 : 0);
    }
    if (search) {
      sql += ` AND (nome LIKE ? OR telefone LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY nome LIMIT 500`;
    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await queryOne(
      `SELECT * FROM profissionais WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!data) return res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authMiddleware, [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { nome, telefone, email, cpf, especialidade, comissao_percentual, foto_url, senha_app } = req.body;
    let senha_hash = null;
    let app_ativo = 0;
    if (senha_app && senha_app.length >= 6) {
      senha_hash = await bcrypt.hash(senha_app, 10);
      app_ativo = 1;
    }

    const result = await queryRun(
      `INSERT INTO profissionais (salao_id, nome, telefone, email, cpf, especialidade, comissao_percentual, foto_url, senha_hash, app_ativo, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.salaoId, nome, telefone || null, email || null, cpf || null,
        especialidade || null, comissao_percentual || 0,
        foto_url || null, senha_hash, app_ativo,
      ]
    );
    const data = await queryOne(`SELECT * FROM profissionais WHERE id = ?`, [result.lastInsertRowid]);
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await queryOne(
      `SELECT * FROM profissionais WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (!existing) return res.status(404).json({ success: false, error: 'Profissional não encontrado' });

    const fields = ['nome', 'telefone', 'email', 'cpf', 'especialidade', 'comissao_percentual', 'foto_url', 'ativo'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        let val = req.body[f];
        if (f === 'ativo') val = val ? 1 : 0;
        params.push(val);
      }
    }
    if (req.body.senha_app && req.body.senha_app.length >= 6) {
      updates.push(`senha_hash = ?`);
      updates.push(`app_ativo = ?`);
      params.push(await bcrypt.hash(req.body.senha_app, 10));
      params.push(1);
    }
    if (updates.length === 0) return res.json({ success: true, data: existing });

    updates.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
    params.push(req.params.id, req.salaoId);

    await queryRun(
      `UPDATE profissionais SET ${updates.join(', ')} WHERE id = ? AND salao_id = ?`,
      params
    );
    const data = await queryOne(`SELECT * FROM profissionais WHERE id = ?`, [req.params.id]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await queryRun(
      `UPDATE profissionais SET ativo = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND salao_id = ?`,
      [req.params.id, req.salaoId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    res.json({ success: true, message: 'Profissional desativado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
