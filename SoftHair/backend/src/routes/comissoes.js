/**
 * P5-A1: cálculo de comissões a partir de atendimentos + comissão_percentual
 * do profissional/serviço.
 *
 * Não-stub: agregação SQL pura. Comissões pagas/estornos ainda são stub
 * porque o fluxo financeiro completo (caixa, pagamento, recibo) é roadmap.
 *
 * GET /api/comissoes?dataInicio=&dataFim=
 *   - retorna lista por profissional com totalAtendimentos, totalReceita,
 *     totalComissao calculado por serviço (preferindo comissao_percentual
 *     do serviço; fallback para o do profissional).
 */
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const params = [];
    let dateFilter = '';
    if (dataInicio) { dateFilter += ' AND a.created_at >= ?'; params.push(dataInicio); }
    if (dataFim) { dateFilter += ' AND a.created_at <= ?'; params.push(dataFim); }

    // Comissão por atendimento: prefere serviço, fallback profissional.
    const rows = await query(
      `SELECT
         p.id AS profissional_id,
         p.nome AS profissional_nome,
         COUNT(a.id) AS total_atendimentos,
         COALESCE(SUM(a.valor), 0) AS total_receita,
         COALESCE(SUM(
           a.valor * (COALESCE(s.comissao_percentual, p.comissao_percentual, 0) / 100.0)
         ), 0) AS total_comissao
       FROM atendimentos a
       LEFT JOIN profissionais p ON p.id = a.profissional_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.status != 'cancelado'
         AND p.id IS NOT NULL
         ${dateFilter}
       GROUP BY p.id, p.nome
       ORDER BY total_comissao DESC`,
      params
    );
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/pagas', authMiddleware, (req, res) => {
  // Stub: pagamento de comissões ainda não implementado no desktop.
  res.json({ success: true, data: [], stub: true, message: 'Pagamento de comissões em desenvolvimento na versão desktop' });
});

router.get('/estornos', authMiddleware, (req, res) => {
  res.json({ success: true, data: [], stub: true, message: 'Estorno de comissões em desenvolvimento na versão desktop' });
});

module.exports = router;
