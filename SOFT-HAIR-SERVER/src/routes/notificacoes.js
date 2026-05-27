const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/role');
const { NotificacaoService } = require('../services');

const service = new NotificacaoService();

// Notificações: leitura para todos os 3 roles (cada um vê as próprias).
// POST/DELETE restritos a admin+recepção via guard explícito.
router.use(authMiddleware, requireAnyRole(['admin', 'recepcao', 'profissional']));
const writeGuard = requireAnyRole(['admin', 'recepcao']);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { lida, tipo, limit } = req.query;
    const result = await service.listar(req.salaoId, { lida, tipo, limit });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/count', authMiddleware, async (req, res) => {
  try {
    const result = await service.contarNaoLidas(req.salaoId);
    res.json({ success: true, data: result.data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.post('/', authMiddleware, writeGuard, [
  body('tipo').notEmpty().withMessage('Tipo obrigatório'),
  body('titulo').notEmpty().withMessage('Título obrigatório'),
  body('mensagem').notEmpty().withMessage('Mensagem obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    // [P4-M3] Whitelist de campos editáveis + validação de tenancy para destinatarios.
    // Sem isso, body forjaria notificações apontando para cliente/usuario de outro salão
    // (que mesmo sem ser visualizada poluiria a tabela de auditoria).
    const allowed = ['tipo', 'titulo', 'mensagem', 'destinatario_tipo', 'destinatario_id', 'cliente_id', 'usuario_id', 'lida'];
    const payload = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    }
    const { query: dbQuery } = require('../config/database');
    if (payload.cliente_id) {
      const ok = await dbQuery('SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2', [payload.cliente_id, req.salaoId]);
      if (!ok.length) return res.status(403).json({ success: false, error: 'Cliente não pertence ao salão' });
    }
    if (payload.usuario_id) {
      const ok = await dbQuery('SELECT 1 FROM usuarios WHERE id = $1 AND salao_id = $2', [payload.usuario_id, req.salaoId]);
      if (!ok.length) return res.status(403).json({ success: false, error: 'Usuário não pertence ao salão' });
    }
    if (payload.destinatario_id && payload.destinatario_tipo) {
      const tabela = payload.destinatario_tipo === 'cliente' ? 'clientes'
        : payload.destinatario_tipo === 'profissional' ? 'profissionais'
        : payload.destinatario_tipo === 'usuario' || payload.destinatario_tipo === 'admin' ? 'usuarios'
        : null;
      if (tabela) {
        const ok = await dbQuery(`SELECT 1 FROM ${tabela} WHERE id = $1 AND salao_id = $2`, [payload.destinatario_id, req.salaoId]);
        if (!ok.length) return res.status(403).json({ success: false, error: 'Destinatário não pertence ao salão' });
      }
    }

    const result = await service.criar(payload, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.put('/:id/lida', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarComoLida(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.put('/marcar-todas-lidas', authMiddleware, async (req, res) => {
  try {
    const result = await service.marcarTodasComoLidas(req.salaoId);
    res.json({ success: true, message: result.message });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.delete('/:id', authMiddleware, writeGuard, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, message: result.message });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
