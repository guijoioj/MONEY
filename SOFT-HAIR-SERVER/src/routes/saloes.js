const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');
const { sendError } = require('../utils/sendError');

// [M6] Rate-limit dedicado: previne enumeração massiva de salões públicos
const publicSaloesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Muitas requisições. Aguarde um minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Listar salões publicamente (para app mobile de clientes)
// [M6] Limita campos públicos (sem email/telefone) e exige termo de busca (mín 2 chars)
router.get('/publico', publicSaloesLimiter, async (req, res) => {
  try {
    const { search } = req.query;
    const term = typeof search === 'string' ? search.trim() : '';
    if (term.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Informe um termo de busca com pelo menos 2 caracteres.'
      });
    }
    const sql = `SELECT id, nome, logo_url
      FROM saloes WHERE ativo = true AND nome ILIKE $1
      ORDER BY nome LIMIT 50`;
    const { rows } = await query(sql, [`%${term}%`]);
    res.json({ success: true, data: rows });
  } catch (error) {
    return sendError(res, 500, 'Erro ao listar salões', error);
  }
});

// Buscar dados do salão atual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const salao = await queryOne('SELECT * FROM saloes WHERE id = $1', [req.salaoId]);
    if (!salao) return res.status(404).json({ success: false, error: 'Salão não encontrado' });
    res.json({ success: true, data: salao });
  } catch (error) {
    return sendError(res, 500, 'Erro ao buscar salão', error);
  }
});

// Atualizar salão atual
router.put('/me', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }),
  body('email').optional().isEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { nome, endereco, telefone, email, cnpj, logo_url, config } = req.body;
    const result = await queryOne(`
      UPDATE saloes SET
        nome = COALESCE($1, nome), endereco = COALESCE($2, endereco),
        telefone = COALESCE($3, telefone), email = COALESCE($4, email),
        cnpj = COALESCE($5, cnpj), logo_url = COALESCE($6, logo_url),
        config = COALESCE($7, config), updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [nome, endereco, telefone, email, cnpj, logo_url, config ? JSON.stringify(config) : null, req.salaoId]);

    res.json({ success: true, data: result });
  } catch (error) {
    return sendError(res, 500, 'Erro ao atualizar salão', error);
  }
});

module.exports = router;
