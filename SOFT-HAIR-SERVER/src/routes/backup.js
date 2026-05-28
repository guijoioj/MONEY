const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { BackupService } = require('../services');
const { sendError } = require('../utils/sendError');
const { pool } = require('../config/database');
const BackupHistory = require('../services/BackupHistoryService');

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

// ─── HISTÓRICO DE BACKUPS (tabela `backups`) ──────────────────────────────
// admin-only. Permite gerar manual, listar, baixar e apagar.

// POST /api/backup/historico — gera backup e salva no histórico (assíncrono na resposta).
router.post('/historico', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await BackupHistory.runBackup({
      salaoId: req.salaoId,
      tipo: 'manual',
      criadoPor: req.user?.userId || null,
    });
    if (!r.success) return sendError(res, 500, 'Falha ao gerar backup', new Error(r.error));
    res.status(201).json({ success: true, data: { id: r.id, tamanho_bytes: r.tamanho_bytes, checksum: r.checksum } });
  } catch (error) { sendError(res, 500, 'Erro interno', error); }
});

// GET /api/backup/historico — lista metadata dos backups do salão (sem dump_data).
router.get('/historico', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.tipo, b.status, b.tamanho_bytes, b.checksum, b.erro,
              b.criado_por, b.created_at, u.nome AS criado_por_nome
         FROM backups b
         LEFT JOIN usuarios u ON u.id = b.criado_por
        WHERE b.salao_id = $1
        ORDER BY b.created_at DESC
        LIMIT 100`,
      [req.salaoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) { sendError(res, 500, 'Erro ao listar backups', error); }
});

// GET /api/backup/historico/:id/download — baixa o dump (gzipped JSON).
router.get('/historico/:id/download', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, salao_id, tamanho_bytes, dump_data, created_at
         FROM backups WHERE id = $1 AND salao_id = $2`,
      [req.params.id, req.salaoId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Backup não encontrado' });
    const b = rows[0];
    if (!b.dump_data) return res.status(410).json({ success: false, error: 'Dump não disponível (registro pode estar em erro)' });
    const name = safeFilename(`softhair-backup-salao-${b.salao_id}-${b.id}-${new Date(b.created_at).toISOString().slice(0,10)}.json.gz`);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Length', String(b.tamanho_bytes || b.dump_data.length));
    res.send(b.dump_data);
  } catch (error) { sendError(res, 500, 'Erro ao baixar backup', error); }
});

// DELETE /api/backup/historico/:id — apaga um backup específico.
router.delete('/historico/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM backups WHERE id = $1 AND salao_id = $2 RETURNING id`,
      [req.params.id, req.salaoId]
    );
    if (!r.rowCount) return res.status(404).json({ success: false, error: 'Backup não encontrado' });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) { sendError(res, 500, 'Erro ao apagar backup', error); }
});

module.exports = router;
