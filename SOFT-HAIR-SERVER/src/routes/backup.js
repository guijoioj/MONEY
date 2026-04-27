const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { BackupService } = require('../services');

const service = new BackupService();

// Gerar backup completo do salão
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await service.gerarBackup(req.salaoId);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download como arquivo JSON
router.get('/download', authMiddleware, async (req, res) => {
  try {
    const result = await service.gerarBackup(req.salaoId);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    const filename = `backup-salao-${req.salaoId}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(result.data, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
