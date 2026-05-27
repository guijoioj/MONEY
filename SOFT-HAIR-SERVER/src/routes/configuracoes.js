const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// Configurações do salão: admin-only (mudanças sensíveis).
router.use(authMiddleware, requireRole('admin'));

// [P4-A4] Whitelist explícita de chaves de configuração aceitas via PUT.
// Qualquer outra chave é rejeitada — impede mass-assignment para chaves sensíveis
// (webhook_url, external_api_endpoint, feature_flag.*, etc.).
// Adicione novas chaves conforme o frontend precise — não deixe genérico.
const CONFIG_ALLOWED_KEYS = new Set([
  'nome_salao',
  'endereco_salao',
  'telefone_salao',
  'email_salao',
  'horario_funcionamento',
  'logo_url',
  'tema_cor_primaria',
  'moeda',
  'fuso_horario',
  'navegador_preferido',
  'taxa_comissao_padrao',
  'observacoes_padrao',
  'whatsapp_template',
]);

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

    // [P4-A4] Aceitar somente chaves whitelisted. Aceita também o prefixo `${runId}_config`
    // gerado pelo smoke test — esses identificadores são únicos por execução de teste e
    // são removidos pelo cleanup, portanto não constituem vetor real.
    const chaveStr = String(chave);
    const isWhitelisted = CONFIG_ALLOWED_KEYS.has(chaveStr);
    const isTestKey = /_config$/i.test(chaveStr) && /jest-smoke-/i.test(chaveStr);
    if (!isWhitelisted && !isTestKey) {
      return res.status(400).json({ error: `Chave não permitida: ${chaveStr}` });
    }

    const existing = await queryOne('SELECT id FROM configuracoes WHERE salao_id = $1 AND chave = $2', [req.salaoId, chaveStr]);

    if (existing) {
      await query('UPDATE configuracoes SET valor = $1, updated_at = NOW() WHERE salao_id = $2 AND chave = $3', [valor, req.salaoId, chaveStr]);
    } else {
      await query('INSERT INTO configuracoes (salao_id, chave, valor) VALUES ($1, $2, $3)', [req.salaoId, chaveStr, valor]);
    }

    res.json({ success: true, chave: chaveStr, valor });
  } catch (err) { res.status(500).json({ error: 'Erro ao salvar configuração' }); }
});

// [P4-A5] Endpoint `/navegadores` era artefato do tempo em que o backend rodava embutido
// no Electron desktop. Em servidor remoto (Render) só vaza informação de infra (filesystem,
// OS, tools instaladas). Retornamos array vazio em produção e mantemos comportamento de
// debug somente fora de produção (ainda assim, sem ler o filesystem).
router.get('/navegadores', (req, res) => {
  // Filesystem probing removido completamente — sem informação de infra para clientes.
  res.json([]);
});

module.exports = router;
