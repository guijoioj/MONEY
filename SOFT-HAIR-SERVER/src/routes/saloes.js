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
    // [P3-M8] Escapa wildcards
    const safe = require('../utils/helpers').escapeLike(term);
    const { rows } = await query(sql, [`%${safe}%`]);
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
// [P5-A7] Validador customizado de logo_url:
// - Permite http(s)://
// - Permite data:image/{png,jpeg,jpg,gif,webp,svg+xml};base64,...
// - Bloqueia javascript:, vbscript:, file:, data:text/html, etc.
function isSafeLogoUrl(value) {
  if (value === null || value === undefined || value === '') return true; // opcional
  if (typeof value !== 'string') return false;
  if (value.length > 2048) return false;
  const v = value.trim();
  // http(s)
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(v)) return true;
  // data: imagem apenas
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(v)) return true;
  return false;
}

router.put('/me', authMiddleware, requireAdmin, [
  body('nome').optional().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('logo_url').optional().custom((v) => {
    if (!isSafeLogoUrl(v)) {
      throw new Error('logo_url inválida (apenas http(s) ou data:image)');
    }
    return true;
  }),
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
