const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { BackupService } = require('../services');
const { sendError } = require('../utils/sendError');

const service = new BackupService();

// [B5] Sanitiza qualquer valor que vá para Content-Disposition: remove CR/LF
// (Header Injection) e mantém apenas chars seguros para filename.
function safeFilename(input) {
  return String(input || 'backup').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

// [B10] Backup contém PII completo do salão. Exige admin + re-auth opcional.
// Frontend deve pedir senha novamente antes de chamar /download.
// Em ausência de 2FA, exigimos pelo menos role=admin. Header opcional
// `x-reauth-token` (futuro: token de re-auth de 5min) é registrado para auditoria.

// Gerar backup completo do salão
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    // [P3-B10] Audit log completo com IP + User-Agent para forense
    console.log(`[BACKUP][AUDIT] salao=${req.salaoId} user=${req.user?.userId} ip=${req.ip} ua="${(req.headers['user-agent'] || '').slice(0, 120)}" reauth=${!!req.headers['x-reauth-token']}`);
    const result = await service.gerarBackup(req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      return sendError(res, 500, 'Erro ao gerar backup', new Error(result.error));
    }
  } catch (error) {
    return sendError(res, 500, 'Erro ao gerar backup', error);
  }
});

// Download como arquivo JSON
router.get('/download', authMiddleware, requireAdmin, async (req, res) => {
  console.log(`[BACKUP][AUDIT][DOWNLOAD] salao=${req.salaoId} user=${req.user?.userId} ip=${req.ip} ua="${(req.headers['user-agent'] || '').slice(0, 120)}"`);
  try {
    const result = await service.gerarBackup(req.salaoId);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    const filename = safeFilename(`backup-salao-${req.salaoId}-${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(result.data, null, 2));
  } catch (error) {
    return sendError(res, 500, 'Erro ao gerar backup', error);
  }
});

// Restaurar backup (admin only)
router.post('/restore', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup) return res.status(400).json({ success: false, error: 'Dados de backup são obrigatórios' });

    const result = await service.restaurarBackup(req.salaoId, backup);
    if (result.success) {
      res.json({ success: true, data: result.data, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
