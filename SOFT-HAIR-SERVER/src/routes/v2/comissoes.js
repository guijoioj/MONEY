/**
 * /api/v2/comissoes — endpoints expandidos com cents, filtros ricos, snapshot.
 *
 * Mantém v1 (/api/comissoes) intacta.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../../middleware/auth');
const { pool, withTransaction } = require('../../config/database');
const { logAction } = require('../../utils/auditLog');
const { sendError } = require('../../utils/sendError');
const Engine = require('../../services/CommissionEngine');
const { addCents, assertCents, equalCents } = require('../../utils/money');

// ============================================================================
// GET /api/v2/comissoes — lista com filtros expandidos
// ============================================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      profissional_id,
      status,
      competencia,           // YYYY-MM ou YYYY-MM-DD
      data_inicio, data_fim, // range em created_at/data_geracao
      venda_id,
      tipo_item,
      papel_profissional,
      origem,
      limit = 100,
      offset = 0,
    } = req.query;

    let sql = `
      SELECT c.*, p.nome AS profissional_nome, cl.nome AS cliente_nome,
             s.nome AS servico_nome, pr.nome AS produto_nome
        FROM comissoes c
        LEFT JOIN profissionais p ON p.id = c.profissional_id
        LEFT JOIN clientes cl ON cl.id = c.cliente_id
        LEFT JOIN servicos s ON s.id = c.servico_id
        LEFT JOIN produtos pr ON pr.id = c.produto_id
       WHERE c.salao_id = $1
    `;
    const params = [req.salaoId];
    let p = 2;

    if (profissional_id)        { sql += ` AND c.profissional_id = $${p++}`; params.push(profissional_id); }
    if (status)                 { sql += ` AND c.status = $${p++}`; params.push(status); }
    if (competencia)            {
      // se YYYY-MM, usa esse mês inteiro; se YYYY-MM-DD, usa o dia
      if (competencia.length === 7) {
        sql += ` AND c.competencia = $${p++}::date`;
        params.push(`${competencia}-01`);
      } else {
        sql += ` AND c.competencia = $${p++}`;
        params.push(competencia);
      }
    }
    if (data_inicio)            { sql += ` AND c.data_geracao >= $${p++}`; params.push(data_inicio); }
    if (data_fim)               { sql += ` AND c.data_geracao <= $${p++}`; params.push(data_fim); }
    if (venda_id)               { sql += ` AND c.venda_id = $${p++}`; params.push(venda_id); }
    if (tipo_item)              { sql += ` AND c.tipo_item = $${p++}`; params.push(tipo_item); }
    if (papel_profissional)     { sql += ` AND c.papel_profissional = $${p++}`; params.push(papel_profissional); }
    if (origem)                 { sql += ` AND c.origem = $${p++}`; params.push(origem); }

    sql += ` ORDER BY c.data_geracao DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(Math.min(Number(limit) || 100, 500), Number(offset) || 0);

    const { rows } = await pool.query(sql, params);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    sendError(res, 500, 'Erro interno', error);
  }
});

// ============================================================================
// GET /api/v2/comissoes/dashboard — agregados
// ============================================================================
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const { competencia, data_inicio, data_fim } = req.query;

    // Totais por status
    let whereExtra = '';
    const params = [req.salaoId];
    let p = 2;
    if (competencia) {
      whereExtra += ` AND competencia = $${p++}::date`;
      params.push(competencia.length === 7 ? `${competencia}-01` : competencia);
    } else if (data_inicio && data_fim) {
      whereExtra += ` AND data_geracao BETWEEN $${p++} AND $${p++}`;
      params.push(data_inicio, data_fim);
    }

    const { rows: totais } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status='pendente' THEN valor_comissao_cents ELSE 0 END), 0)::bigint AS total_pendente_cents,
         COALESCE(SUM(CASE WHEN status='paga'     THEN valor_comissao_cents ELSE 0 END), 0)::bigint AS total_pago_cents,
         COALESCE(SUM(CASE WHEN status='estornada' THEN valor_comissao_cents ELSE 0 END), 0)::bigint AS total_estornado_cents,
         COUNT(*)::int AS quantidade_total,
         COUNT(*) FILTER (WHERE status='pendente')::int AS quantidade_pendente,
         COUNT(*) FILTER (WHERE status='paga')::int AS quantidade_paga
        FROM comissoes
       WHERE salao_id = $1 ${whereExtra}`,
      params
    );

    // Ajustes
    const { rows: ajustes } = await pool.query(
      `SELECT
         COALESCE(SUM(valor_cents), 0)::bigint AS total_ajustes_cents,
         COUNT(*)::int AS quantidade_ajustes
        FROM comissoes_ajustes
       WHERE salao_id = $1 AND status IN ('pendente','aplicado') ${whereExtra.replace(/c\./g, '').replace('competencia', 'competencia').replace('data_geracao', 'created_at')}`,
      params
    );

    // Ranking profissionais (top 10)
    const { rows: ranking } = await pool.query(
      `SELECT p.id, p.nome,
              COALESCE(SUM(c.valor_comissao_cents), 0)::bigint AS total_cents,
              COUNT(c.id)::int AS quantidade
         FROM comissoes c
         JOIN profissionais p ON p.id = c.profissional_id
        WHERE c.salao_id = $1 AND c.status IN ('pendente','paga') ${whereExtra}
        GROUP BY p.id, p.nome
        ORDER BY total_cents DESC
        LIMIT 10`,
      params
    );

    // Por tipo de item
    const { rows: porTipo } = await pool.query(
      `SELECT tipo_item,
              COALESCE(SUM(valor_comissao_cents), 0)::bigint AS total_cents,
              COUNT(*)::int AS quantidade
         FROM comissoes
        WHERE salao_id = $1 AND tipo_item IS NOT NULL ${whereExtra}
        GROUP BY tipo_item`,
      params
    );

    res.json({
      success: true,
      data: {
        ...totais[0],
        ...ajustes[0],
        ranking_profissionais: ranking,
        por_tipo_item: porTipo,
      },
    });
  } catch (error) {
    sendError(res, 500, 'Erro interno', error);
  }
});

// ============================================================================
// GET /api/v2/comissoes/profissional/:id/extrato — holerite
// ============================================================================
router.get('/profissional/:id/extrato', authMiddleware, async (req, res) => {
  try {
    const profId = Number(req.params.id);
    const { competencia, data_inicio, data_fim } = req.query;

    // Authz: profissional só vê próprio extrato; admin vê todos
    if (!req.user?.is_admin && req.user?.profissional_id !== profId) {
      return res.status(403).json({ success: false, error: 'Acesso negado ao extrato' });
    }

    // Confirma tenancy do profissional
    const profOk = await pool.query(
      'SELECT id, nome FROM profissionais WHERE id = $1 AND salao_id = $2',
      [profId, req.salaoId]
    );
    if (!profOk.rows.length) {
      return res.status(404).json({ success: false, error: 'Profissional não encontrado neste salão' });
    }

    let filtroData = '';
    const params = [req.salaoId, profId];
    let p = 3;
    if (competencia) {
      filtroData += ` AND competencia = $${p++}::date`;
      params.push(competencia.length === 7 ? `${competencia}-01` : competencia);
    } else if (data_inicio && data_fim) {
      filtroData += ` AND data_geracao BETWEEN $${p++} AND $${p++}`;
      params.push(data_inicio, data_fim);
    }

    // Comissões detalhadas
    const { rows: comissoes } = await pool.query(
      `SELECT c.*, cl.nome AS cliente_nome, s.nome AS servico_nome,
              pr.nome AS produto_nome, v.id AS venda_id_ref
         FROM comissoes c
         LEFT JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN servicos s ON s.id = c.servico_id
         LEFT JOIN produtos pr ON pr.id = c.produto_id
         LEFT JOIN vendas v ON v.id = c.venda_id
        WHERE c.salao_id = $1 AND c.profissional_id = $2 ${filtroData}
        ORDER BY c.data_geracao DESC
        LIMIT 500`,
      params
    );

    // Ajustes
    const { rows: ajustes } = await pool.query(
      `SELECT * FROM comissoes_ajustes
        WHERE salao_id = $1 AND profissional_id = $2
        ORDER BY created_at DESC LIMIT 100`,
      [req.salaoId, profId]
    );

    // Pagamentos
    const { rows: pagamentos } = await pool.query(
      `SELECT * FROM comissoes_pagamentos_v2
        WHERE salao_id = $1 AND profissional_id = $2
        ORDER BY created_at DESC LIMIT 50`,
      [req.salaoId, profId]
    );

    // Totais
    const totalPendenteCents = comissoes
      .filter(c => c.status === 'pendente')
      .reduce((s, c) => s + Number(c.valor_comissao_cents || 0), 0);
    const totalPagoCents = comissoes
      .filter(c => c.status === 'paga')
      .reduce((s, c) => s + Number(c.valor_comissao_cents || 0), 0);
    const totalAjustesPendentes = ajustes
      .filter(a => a.status === 'pendente')
      .reduce((s, a) => s + Number(a.valor_cents || 0), 0);

    res.json({
      success: true,
      data: {
        profissional: profOk.rows[0],
        periodo: { competencia, data_inicio, data_fim },
        total_pendente_cents: totalPendenteCents,
        total_pago_cents: totalPagoCents,
        total_ajustes_pendentes_cents: totalAjustesPendentes,
        liquido_a_pagar_cents: totalPendenteCents + totalAjustesPendentes,
        comissoes,
        ajustes,
        pagamentos,
      },
    });
  } catch (error) {
    sendError(res, 500, 'Erro interno', error);
  }
});

// ============================================================================
// POST /api/v2/comissoes/simulador — simula sem persistir
// ============================================================================
router.post('/simulador', authMiddleware, async (req, res) => {
  try {
    const ctx = {
      salaoId: req.salaoId,
      profissionalId: req.body.profissional_id,
      papel: req.body.papel || 'principal',
      servicoId: req.body.servico_id || null,
      produtoId: req.body.produto_id || null,
      categoria: req.body.categoria || null,
      tipoItem: req.body.tipo_item || (req.body.servico_id ? 'servico' : 'produto'),
      valorBrutoCents: req.body.valor_bruto_cents ?? 0,
      descontoCents: req.body.desconto_cents ?? 0,
      acrescimoCents: req.body.acrescimo_cents ?? 0,
      taxaCartaoCents: req.body.taxa_cartao_cents ?? 0,
      custoProdutoCents: req.body.custo_produto_cents ?? 0,
      dataAtendimento: req.body.data_atendimento ? new Date(req.body.data_atendimento) : new Date(),
      formaPagamento: req.body.forma_pagamento || null,
      percentualParticipacao: req.body.percentual_participacao ?? 100,
    };
    const regras = await Engine.Repository.getRegrasVigentes(req.salaoId, ctx.dataAtendimento);

    // Suporta múltiplos profissionais (split)
    if (Array.isArray(req.body.profissionais) && req.body.profissionais.length > 0) {
      const result = Engine.SplitCalculator.calculateSplit(ctx, req.body.profissionais, regras);
      // Adiciona assistentes se houver
      if (Array.isArray(req.body.assistentes) && req.body.assistentes.length > 0) {
        const principal = result[0];
        const asst = Engine.AssistantCalculator.calculateAssistant(ctx, req.body.assistentes, principal, regras);
        return res.json({ success: true, data: { principal: result, assistentes: asst } });
      }
      return res.json({ success: true, data: { principal: result } });
    }

    const result = Engine.calculate(ctx, regras);
    res.json({ success: true, data: result });
  } catch (error) {
    sendError(res, 500, 'Erro no simulador', error);
  }
});

// ============================================================================
// POST /api/v2/comissoes/pagar — pagamento em lote
// ============================================================================
router.post('/pagar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const {
      profissional_id,
      data_inicio, data_fim,
      comissoes_ids,
      ajustes_ids,
      valor_confirmado_cents,
      forma_pagamento,
      observacao,
      idempotency_key,
    } = req.body;

    if (!profissional_id) {
      return res.status(400).json({ success: false, error: 'profissional_id obrigatório' });
    }
    if (!idempotency_key) {
      return res.status(400).json({ success: false, error: 'idempotency_key obrigatório' });
    }

    // Idempotência: já existe pagamento com esse key?
    const existing = await pool.query(
      'SELECT * FROM comissoes_pagamentos_v2 WHERE salao_id = $1 AND idempotency_key = $2',
      [req.salaoId, idempotency_key]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: existing.rows[0],
        idempotent_replay: true,
      });
    }

    const result = await withTransaction(async (client) => {
      // Tenancy do profissional
      const profOk = await client.query(
        'SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2',
        [profissional_id, req.salaoId]
      );
      if (!profOk.rows.length) {
        return { code: 403, body: { success: false, error: 'profissional_id não pertence ao salão' } };
      }

      // Carrega comissões pendentes do profissional
      let comissoes = [];
      if (Array.isArray(comissoes_ids) && comissoes_ids.length > 0) {
        const r = await client.query(
          `SELECT * FROM comissoes
            WHERE id = ANY($1::int[])
              AND salao_id = $2
              AND profissional_id = $3
              AND status = 'pendente'`,
          [comissoes_ids, req.salaoId, profissional_id]
        );
        comissoes = r.rows;
      } else if (data_inicio && data_fim) {
        const r = await client.query(
          `SELECT * FROM comissoes
            WHERE salao_id = $1 AND profissional_id = $2
              AND status = 'pendente'
              AND data_geracao BETWEEN $3 AND $4`,
          [req.salaoId, profissional_id, data_inicio, data_fim]
        );
        comissoes = r.rows;
      }

      // Carrega ajustes pendentes
      let ajustes = [];
      if (Array.isArray(ajustes_ids) && ajustes_ids.length > 0) {
        const r = await client.query(
          `SELECT * FROM comissoes_ajustes
            WHERE id = ANY($1::int[])
              AND salao_id = $2
              AND profissional_id = $3
              AND status = 'pendente'`,
          [ajustes_ids, req.salaoId, profissional_id]
        );
        ajustes = r.rows;
      }

      if (comissoes.length === 0 && ajustes.length === 0) {
        return { code: 409, body: { success: false, error: 'Nenhuma comissão ou ajuste pendente pra pagar' } };
      }

      const totalComissoesCents = comissoes.reduce((s, c) => s + Number(c.valor_comissao_cents || 0), 0);
      const totalAjustesCents = ajustes.reduce((s, a) => s + Number(a.valor_cents || 0), 0);
      const totalCents = totalComissoesCents + totalAjustesCents;

      // Reconciliação: bloqueia divergência (tolerância 1¢)
      if (valor_confirmado_cents != null && !equalCents(Number(valor_confirmado_cents), totalCents, 1)) {
        throw new Error(
          `Valor confirmado (${valor_confirmado_cents} cents) divergente do total real (${totalCents} cents)`
        );
      }

      // Cria registro de pagamento
      const periodoInicio = data_inicio || (comissoes[0]?.competencia ?? new Date().toISOString().slice(0,10));
      const periodoFim = data_fim || (comissoes[comissoes.length-1]?.competencia ?? new Date().toISOString().slice(0,10));

      const { rows: pagamento } = await client.query(
        `INSERT INTO comissoes_pagamentos_v2 (
           salao_id, profissional_id, valor_total_cents, quantidade_comissoes,
           quantidade_ajustes, periodo_inicio, periodo_fim, status, observacao,
           forma_pagamento, idempotency_key, criado_por
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pago',$8,$9,$10,$11)
         RETURNING *`,
        [req.salaoId, profissional_id, totalCents, comissoes.length, ajustes.length,
         periodoInicio, periodoFim, observacao || null, forma_pagamento || null,
         idempotency_key, req.user?.userId || null]
      );

      // Marca comissões como pagas + vincula ao lote
      if (comissoes.length > 0) {
        await client.query(
          `UPDATE comissoes
              SET status = 'paga',
                  pagamento_lote_id = $1,
                  data_pagamento = CURRENT_DATE,
                  pago = true
            WHERE id = ANY($2::int[])`,
          [pagamento[0].id, comissoes.map(c => c.id)]
        );
      }

      // Marca ajustes como aplicados + vincula ao lote
      if (ajustes.length > 0) {
        await client.query(
          `UPDATE comissoes_ajustes
              SET status = 'aplicado', pagamento_lote_id = $1
            WHERE id = ANY($2::int[])`,
          [pagamento[0].id, ajustes.map(a => a.id)]
        );
      }

      await logAction({
        req,
        action: 'comissao.pagar_lote_v2',
        entityType: 'comissoes_pagamentos_v2',
        entityId: pagamento[0].id,
        after: {
          profissional_id, valor_total_cents: totalCents,
          comissoes_ids: comissoes.map(c => c.id),
          ajustes_ids: ajustes.map(a => a.id),
        },
      });

      return { code: 201, body: { success: true, data: pagamento[0] } };
    });

    res.status(result.code).json(result.body);
  } catch (error) {
    sendError(res, 500, 'Erro no pagamento', error);
  }
});

// ============================================================================
// POST /api/v2/comissoes/estornar — estorno (pendente → estornada, paga → ajuste)
// ============================================================================
router.post('/estornar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { comissao_id, venda_id, motivo, valor_parcial_cents } = req.body;

    if (!motivo || motivo.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'motivo obrigatório' });
    }
    if (!comissao_id && !venda_id) {
      return res.status(400).json({ success: false, error: 'comissao_id ou venda_id obrigatório' });
    }

    const result = await withTransaction(async (client) => {
      // Carrega alvos
      let comissoes;
      if (comissao_id) {
        const r = await client.query(
          'SELECT * FROM comissoes WHERE id = $1 AND salao_id = $2',
          [comissao_id, req.salaoId]
        );
        comissoes = r.rows;
      } else {
        const r = await client.query(
          'SELECT * FROM comissoes WHERE venda_id = $1 AND salao_id = $2',
          [venda_id, req.salaoId]
        );
        comissoes = r.rows;
      }
      if (!comissoes.length) {
        return { code: 404, body: { success: false, error: 'Comissão(ões) não encontrada(s)' } };
      }

      const afetadas = [];
      const ajustesCriados = [];

      for (const c of comissoes) {
        if (c.status === 'pendente') {
          // Pendente: marca estornada
          await client.query(
            'UPDATE comissoes SET status = $1, motivo_bloqueio = $2 WHERE id = $3',
            ['estornada', motivo, c.id]
          );
          afetadas.push(c.id);
        } else if (c.status === 'paga') {
          // Paga: gera ajuste negativo (preserva histórico)
          const valorEstorno = valor_parcial_cents != null
            ? -Math.abs(Number(valor_parcial_cents))
            : -Number(c.valor_comissao_cents);

          const { rows: aj } = await client.query(
            `INSERT INTO comissoes_ajustes (
               salao_id, profissional_id, tipo, valor_cents, motivo,
               competencia, comissao_origem_id, status, criado_por
             ) VALUES ($1,$2,'estorno',$3,$4,$5,$6,'pendente',$7)
             RETURNING *`,
            [c.salao_id, c.profissional_id, valorEstorno, motivo,
             c.competencia, c.id, req.user?.userId || null]
          );
          ajustesCriados.push(aj[0]);
          afetadas.push(c.id);
        }
      }

      await logAction({
        req,
        action: 'comissao.estornar_v2',
        entityType: 'comissao',
        entityId: comissao_id || null,
        after: { motivo, comissoes_afetadas: afetadas, ajustes_criados: ajustesCriados.map(a => a.id) },
      });

      return {
        code: 201,
        body: {
          success: true,
          data: { comissoes_afetadas: afetadas, ajustes_criados: ajustesCriados }
        },
      };
    });

    res.status(result.code).json(result.body);
  } catch (error) {
    sendError(res, 500, 'Erro no estorno', error);
  }
});

module.exports = router;
