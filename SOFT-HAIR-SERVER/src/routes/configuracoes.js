const express = require('express');
const fs = require('fs');
const router = express.Router();
const { query, queryOne } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const configs = await query('SELECT chave, valor FROM configuracoes WHERE salao_id = $1', [req.salaoId]);
    const configObj = {};
    configs.forEach(c => { configObj[c.chave] = c.valor; });
    res.json(configObj);
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar configurações' }); }
});

router.put('/', async (req, res) => {
  try {
    const { chave, valor } = req.body;
    if (!chave) return res.status(400).json({ error: 'Chave obrigatória' });

    const existing = await queryOne('SELECT id FROM configuracoes WHERE salao_id = $1 AND chave = $2', [req.salaoId, chave]);

    if (existing) {
      await query('UPDATE configuracoes SET valor = $1, updated_at = NOW() WHERE salao_id = $2 AND chave = $3', [valor, req.salaoId, chave]);
    } else {
      await query('INSERT INTO configuracoes (salao_id, chave, valor) VALUES ($1, $2, $3)', [req.salaoId, chave, valor]);
    }

    res.json({ success: true, chave, valor });
  } catch (err) { res.status(500).json({ error: 'Erro ao salvar configuração' }); }
});

router.get('/navegadores', (req, res) => {
  const browsers = [];
  const candidates = [
    { name: 'Firefox', command: 'firefox', paths: ['/usr/bin/firefox', '/snap/bin/firefox'] },
    { name: 'Chromium', command: 'chromium', paths: ['/usr/bin/chromium', '/snap/bin/chromium', '/usr/bin/chromium-browser'] },
    { name: 'Chrome', command: 'google-chrome', paths: ['/usr/bin/google-chrome', '/snap/bin/google-chrome'] },
    { name: 'Brave', command: 'brave', paths: ['/opt/brave-bin/brave', '/usr/bin/brave-browser', '/snap/bin/brave'] },
    { name: 'Opera', command: 'opera', paths: ['/usr/bin/opera'] },
    { name: 'Vivaldi', command: 'vivaldi', paths: ['/usr/bin/vivaldi'] },
    { name: 'Edge', command: 'microsoft-edge', paths: ['/usr/bin/microsoft-edge'] },
  ];
  candidates.forEach(browser => {
    const found = browser.paths.find(p => { try { return fs.existsSync(p); } catch { return false; } });
    if (found) browsers.push({ name: browser.name, command: browser.command, path: found });
  });
  res.json(browsers);
});

module.exports = router;
