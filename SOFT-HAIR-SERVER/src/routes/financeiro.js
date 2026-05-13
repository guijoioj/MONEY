const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

// DRE mensal
router.get('/dre', authMiddleware, async (req, res) => {
  try {
    const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const ano = parseInt(req.query.ano) || new Date().getFullYear();
    const salaoId = req.salaoId;

    // Receitas
    const receitasResult = await query(
      `SELECT tipo, SUM(valor_final) as total FROM vendas
       WHERE salao_id=$1 AND status='concluida'
       AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3
       GROUP BY tipo`,
      [salaoId, mes, ano]
    );

    const receitaDetalhes = receitasResult.map(r => ({
      tipo: r.tipo,
      total: parseFloat(r.total || 0)
    }));
    const receitaTotal = receitaDetalhes.reduce((s, r) => s + r.total, 0);

    // Despesas
    const despesasResult = await query(
      `SELECT categoria, SUM(valor) as total FROM despesas
       WHERE salao_id=$1 AND EXTRACT(MONTH FROM data)=$2 AND EXTRACT(YEAR FROM data)=$3
       GROUP BY categoria`,
      [salaoId, mes, ano]
    );

    const despesaDetalhes = despesasResult.map(d => ({
      categoria: d.categoria,
      total: parseFloat(d.total || 0)
    }));
    const despesaTotal = despesaDetalhes.reduce((s, d) => s + d.total, 0);

    // Comissões
    const comissoesResult = await query(
      `SELECT SUM(valor_comissao) as total FROM comissoes
       WHERE salao_id=$1 AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3`,
      [salaoId, mes, ano]
    );
    const comissoesTotal = parseFloat(comissoesResult[0]?.total || 0);

    const lucroBruto = receitaTotal - comissoesTotal;
    const lucroLiquido = lucroBruto - despesaTotal;
    const margem = receitaTotal > 0 ? ((lucroLiquido / receitaTotal) * 100).toFixed(1) : '0.0';

    res.json({
      success: true,
      data: {
        mes, ano,
        receitas: { total: receitaTotal, detalhes: receitaDetalhes },
        despesas: { total: despesaTotal, detalhes: despesaDetalhes },
        comissoes: { total: comissoesTotal },
        lucroBruto,
        lucroLiquido,
        margem
      }
    });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Projeção — histórico 12 meses + projeção
router.get('/projecao', authMiddleware, async (req, res) => {
  try {
    const salaoId = req.salaoId;
    const hoje = new Date();
    const historico = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = d.getMonth() + 1;
      const ano = d.getFullYear();

      const recResult = await query(
        `SELECT COALESCE(SUM(valor_final), 0) as receita FROM vendas
         WHERE salao_id=$1 AND status='concluida'
         AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3`,
        [salaoId, mes, ano]
      );
      const despResult = await query(
        `SELECT COALESCE(SUM(valor), 0) as despesa FROM despesas
         WHERE salao_id=$1 AND EXTRACT(MONTH FROM data)=$2 AND EXTRACT(YEAR FROM data)=$3`,
        [salaoId, mes, ano]
      );

      historico.push({
        mes, ano,
        label: `${String(mes).padStart(2,'0')}/${ano}`,
        receita: parseFloat(recResult[0].receita),
        despesa: parseFloat(despResult[0].despesa)
      });
    }

    const ultimos3 = historico.slice(-3);
    const mediaUltimos3 = ultimos3.reduce((s, r) => s + r.receita, 0) / 3;

    const penultimo = historico[historico.length - 2]?.receita || 0;
    const ultimo = historico[historico.length - 1]?.receita || 0;
    const tendencia = penultimo > 0 ? ((ultimo - penultimo) / penultimo) * 100 : 0;

    const projecao = mediaUltimos3 * (1 + tendencia / 100);

    // Label próximo mês
    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    const projecaoLabel = `${String(proximo.getMonth() + 1).padStart(2,'0')}/${proximo.getFullYear()}`;

    res.json({
      success: true,
      data: {
        historico,
        mediaUltimos3: parseFloat(mediaUltimos3.toFixed(2)),
        tendencia: parseFloat(tendencia.toFixed(1)),
        projecao: parseFloat(projecao.toFixed(2)),
        projecaoLabel
      }
    });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
