/**
 * P6-C1: rotas de Financeiro (DRE + Projeção).
 *
 * Agrega vendas, atendimentos, comissões e despesas em SQL puro
 * — sem tabela própria. Suficiente para Financeiro.jsx.
 */
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

function monthBounds(mes, ano) {
  const m = String(mes).padStart(2, '0');
  const inicio = `${ano}-${m}-01`;
  const lastDay = new Date(Number(ano), Number(mes), 0).getDate();
  const fim = `${ano}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { inicio, fim };
}

router.get('/dre', authMiddleware, async (req, res) => {
  try {
    const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
    const ano = parseInt(req.query.ano) || new Date().getFullYear();
    const { inicio, fim } = monthBounds(mes, ano);

    const receitaVendas = await query(
      `SELECT tipo, COALESCE(SUM(valor_final), 0) AS total
       FROM vendas
       WHERE salao_id = ? AND status != 'cancelada'
         AND date(created_at) BETWEEN ? AND ?
       GROUP BY tipo`,
      [req.salaoId, inicio, fim]
    );
    const receitaTotal = (receitaVendas || []).reduce((a, r) => a + Number(r.total || 0), 0);

    const comissoes = await queryOne(
      `SELECT COALESCE(SUM(
         a.valor * (COALESCE(s.comissao_percentual, p.comissao_percentual, 0) / 100.0)
       ), 0) AS total
       FROM atendimentos a
       LEFT JOIN profissionais p ON p.id = a.profissional_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.salao_id = ? AND a.status != 'cancelado'
         AND date(a.created_at) BETWEEN ? AND ?`,
      [req.salaoId, inicio, fim]
    );

    const despesas = await query(
      `SELECT COALESCE(categoria, 'Outros') AS categoria, COALESCE(SUM(valor), 0) AS total
       FROM despesas
       WHERE salao_id = ? AND data BETWEEN ? AND ?
       GROUP BY categoria
       ORDER BY total DESC`,
      [req.salaoId, inicio, fim]
    );
    const despesaTotal = (despesas || []).reduce((a, r) => a + Number(r.total || 0), 0);

    const comissaoTotal = Number(comissoes?.total || 0);
    const lucroBruto = receitaTotal - comissaoTotal;
    const lucroLiquido = lucroBruto - despesaTotal;
    const margem = receitaTotal > 0
      ? ((lucroLiquido / receitaTotal) * 100).toFixed(1)
      : '0.0';

    res.json({
      success: true,
      data: {
        mes,
        ano,
        receitas: { total: receitaTotal, detalhes: receitaVendas || [] },
        comissoes: { total: comissaoTotal },
        lucroBruto,
        despesas: { total: despesaTotal, detalhes: despesas || [] },
        lucroLiquido,
        margem,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/projecao', authMiddleware, async (req, res) => {
  try {
    // Histórico 12 meses: agrupa receita por mês.
    const historico = await query(
      `SELECT strftime('%Y-%m', created_at) AS ym,
              COALESCE(SUM(valor_final), 0) AS receita
       FROM vendas
       WHERE salao_id = ? AND status != 'cancelada'
         AND date(created_at) >= date('now', '-12 months')
       GROUP BY ym
       ORDER BY ym`,
      [req.salaoId]
    );
    const despesasMes = await query(
      `SELECT strftime('%Y-%m', data) AS ym,
              COALESCE(SUM(valor), 0) AS despesa
       FROM despesas
       WHERE salao_id = ?
         AND date(data) >= date('now', '-12 months')
       GROUP BY ym
       ORDER BY ym`,
      [req.salaoId]
    );
    const despesasMap = Object.fromEntries((despesasMes || []).map((r) => [r.ym, Number(r.despesa || 0)]));
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const historicoFmt = (historico || []).map((r) => {
      const [y, m] = r.ym.split('-');
      return {
        label: `${meses[parseInt(m) - 1]}/${y.slice(2)}`,
        ym: r.ym,
        receita: Number(r.receita || 0),
        despesa: despesasMap[r.ym] || 0,
      };
    });

    // Média últimos 3 + tendência
    const ult3 = historicoFmt.slice(-3);
    const mediaUltimos3 = ult3.length > 0
      ? ult3.reduce((a, r) => a + r.receita, 0) / ult3.length
      : 0;
    let tendencia = 0;
    if (ult3.length >= 2) {
      const inicio = ult3[0].receita || 1;
      const fim = ult3[ult3.length - 1].receita || 0;
      tendencia = inicio > 0 ? (((fim - inicio) / inicio) * 100).toFixed(1) : 0;
    }
    const projecao = mediaUltimos3 * (1 + Number(tendencia) / 100);

    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const projecaoLabel = `${meses[next.getMonth()]}/${String(next.getFullYear()).slice(2)}`;

    res.json({
      success: true,
      data: {
        historico: historicoFmt,
        mediaUltimos3,
        tendencia: Number(tendencia),
        projecao,
        projecaoLabel,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
