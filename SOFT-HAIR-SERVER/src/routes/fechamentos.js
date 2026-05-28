const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireRole, requireAnyRole } = require('../middleware/role');
const { FechamentoService } = require('../services');
const { logAction } = require('../utils/auditLog');

const service = new FechamentoService();

// Split: fechamento por CLIENTE (caixa do cliente) → admin + recepção (operação de salão).
// Fechamento financeiro do salão (período) → admin-only.
// Aplicado por rota; sem router.use blanket.
const adminOrRecepcao = requireAnyRole(['admin', 'recepcao']);
const adminOnly = requireRole('admin');

// GET / — lista fechamentos do salão (admin-only — agregação financeira).
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, tipo } = req.query;
    const result = await service.listar(req.salaoId, { status, tipo });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Fechamentos em aberto — admin + recepção (operação de salão).
// Frontend (pages/Fechamento.jsx) espera: [{ clienteId, clienteNome, clienteTelefone, atendimentos:[], vendas:[], totalGeral }]
router.get('/em-aberto', authMiddleware, adminOrRecepcao, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { profissionalId, clienteId, clienteNome, data: dataFiltro } = req.query;

    // Predicado: atendimento finalizado/concluido sem fechamento ainda.
    // Considera fechado se está em fechamento.atendimento_ids (preferência), OU,
    // se for fechamento legado de período sem array, cai no fallback de data+cliente.
    const aParams = [req.salaoId];
    let aWhere = `a.salao_id = $1
      AND a.status IN ('em_andamento','aberto','finalizado','concluido','concluida')
      AND NOT EXISTS (
        SELECT 1 FROM fechamentos f
         WHERE f.salao_id = a.salao_id
           AND COALESCE(f.deleted_at, NULL) IS NULL
           AND (
             (f.atendimento_ids IS NOT NULL AND a.id = ANY(f.atendimento_ids))
             OR
             (f.atendimento_ids IS NULL AND f.cliente_id IS NOT NULL
              AND f.cliente_id = a.cliente_id
              AND a.created_at::date BETWEEN f.data_inicio AND f.data_fim)
           )
      )`;
    let ap = 2;
    if (profissionalId) { aWhere += ` AND a.profissional_id = $${ap++}`; aParams.push(profissionalId); }
    if (clienteId)      { aWhere += ` AND a.cliente_id = $${ap++}`;      aParams.push(clienteId); }
    if (clienteNome)    { aWhere += ` AND c.nome ILIKE '%' || $${ap++} || '%'`; aParams.push(clienteNome); }
    // Filtro por dia (data_atendimento, cai pra created_at). Fechamento só do dia atual.
    if (dataFiltro)     { aWhere += ` AND DATE(COALESCE(a.data_atendimento, a.created_at)) = $${ap++}`; aParams.push(dataFiltro); }

    const atendQuery = pool.query(`
      SELECT a.id, a.cliente_id, a.profissional_id, a.valor AS total_geral,
             a.created_at AS data, a.observacoes,
             c.nome  AS cliente_nome, c.telefone AS cliente_telefone,
             p.nome  AS profissional_nome
        FROM atendimentos a
        LEFT JOIN clientes c       ON c.id = a.cliente_id
        LEFT JOIN profissionais p  ON p.id = a.profissional_id
       WHERE ${aWhere}
       ORDER BY a.created_at DESC
    `, aParams);

    // Vendas em aberto: status != cancelada/paga + aliases legados (concluida/finalizada
     // são tratados como 'paga' até a migration UPDATE rodar em produção).
    const vParams = [req.salaoId];
    let vWhere = `v.salao_id = $1
      AND COALESCE(v.status,'pendente') NOT IN ('cancelada', 'paga', 'concluida', 'finalizada')
      AND NOT EXISTS (
        SELECT 1 FROM fechamentos f
         WHERE f.salao_id = v.salao_id
           AND COALESCE(f.deleted_at, NULL) IS NULL
           AND (
             (f.venda_ids IS NOT NULL AND v.id = ANY(f.venda_ids))
             OR
             (f.venda_ids IS NULL AND f.cliente_id IS NOT NULL
              AND f.cliente_id = v.cliente_id
              AND v.created_at::date BETWEEN f.data_inicio AND f.data_fim)
           )
      )`;
    let vp = 2;
    if (profissionalId) { vWhere += ` AND v.profissional_id = $${vp++}`; vParams.push(profissionalId); }
    if (clienteId)      { vWhere += ` AND v.cliente_id = $${vp++}`;      vParams.push(clienteId); }
    if (clienteNome)    { vWhere += ` AND c.nome ILIKE '%' || $${vp++} || '%'`; vParams.push(clienteNome); }
    if (dataFiltro)     { vWhere += ` AND DATE(COALESCE(v.data, v.created_at)) = $${vp++}`; vParams.push(dataFiltro); }

    const vendasQuery = pool.query(`
      SELECT v.id, v.cliente_id, v.profissional_id AS vendedor_id,
             v.valor_final AS total, v.created_at AS data,
             c.nome AS cliente_nome, c.telefone AS cliente_telefone,
             p.nome AS vendedor_nome
        FROM vendas v
        LEFT JOIN clientes c      ON c.id = v.cliente_id
        LEFT JOIN profissionais p ON p.id = v.profissional_id
       WHERE ${vWhere}
       ORDER BY v.created_at DESC
    `, vParams).catch((err) => {
      console.error('em-aberto vendas query falhou:', err.message);
      return { rows: [] };
    });

    const [atendRes, vendasRes] = await Promise.all([atendQuery, vendasQuery]);

    // Servicos por atendimento — usa snapshot da nova tabela atendimentos_servicos.
    const atendIds = atendRes.rows.map(r => r.id).filter(Boolean);
    let servicosPorAtend = {};
    if (atendIds.length > 0) {
      try {
        const { rows: svcRows } = await pool.query(`
          SELECT asv.atendimento_id,
                 asv.servico_id,
                 COALESCE(asv.nome_snapshot, s.nome) AS servico_nome,
                 asv.valor_snapshot,
                 asv.quantidade,
                 asv.subtotal
            FROM atendimentos_servicos asv
            LEFT JOIN servicos s ON s.id = asv.servico_id
           WHERE asv.atendimento_id = ANY($1::int[])
        `, [atendIds]);
        svcRows.forEach(r => {
          const k = r.atendimento_id;
          if (!servicosPorAtend[k]) servicosPorAtend[k] = [];
          servicosPorAtend[k].push(r);
        });
      } catch (e) { console.warn('[em-aberto] svc query falhou:', e.message); }
    }

    // Itens por venda
    const vendaIds = vendasRes.rows.map(r => r.id).filter(Boolean);
    let itensPorVenda = {};
    if (vendaIds.length > 0) {
      try {
        const { rows: itRows } = await pool.query(`
          SELECT vi.venda_id, vi.produto_id, vi.quantidade, vi.preco_unitario,
                 p.nome AS item_nome
            FROM venda_itens vi
            LEFT JOIN produtos p ON p.id = vi.produto_id
           WHERE vi.venda_id = ANY($1::int[])
        `, [vendaIds]);
        itRows.forEach(r => {
          const k = r.venda_id;
          if (!itensPorVenda[k]) itensPorVenda[k] = [];
          itensPorVenda[k].push(r);
        });
      } catch (e) { console.warn('[em-aberto] itens query falhou:', e.message); }
    }

    // Agrupa por cliente
    const grupos = new Map();
    const ensure = (cid, nome, telefone) => {
      const key = cid || 'sem-cliente';
      if (!grupos.has(key)) {
        grupos.set(key, {
          cliente_id: cid || null,
          cliente_nome: nome || 'Cliente sem cadastro',
          cliente_telefone: telefone || null,
          atendimentos: [],
          vendas: [],
          total_geral: 0,
        });
      }
      return grupos.get(key);
    };

    atendRes.rows.forEach(a => {
      const g = ensure(a.cliente_id, a.cliente_nome, a.cliente_telefone);
      const total = Number(a.total_geral || 0);
      g.atendimentos.push({
        ...a,
        servicos: servicosPorAtend[a.id] || [],
        produtos: [],
        total_produtos_calc: 0,
      });
      g.total_geral += total;
    });

    vendasRes.rows.forEach(v => {
      const g = ensure(v.cliente_id, v.cliente_nome, v.cliente_telefone);
      const total = Number(v.total || 0);
      g.vendas.push({
        ...v,
        itens: itensPorVenda[v.id] || [],
      });
      g.total_geral += total;
    });

    // Filtra grupos vazios (não deveria ocorrer, mas defesa)
    const data = [...grupos.values()].filter(g => (g.atendimentos.length + g.vendas.length) > 0);

    res.json({ success: true, data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// GET /:id — detalhe de fechamento.
//   Admin: vê qualquer um.
//   Recepção: só vê tipo='cliente' (caixa do cliente). Período/financeiro → 403.
router.get('/:id', authMiddleware, adminOrRecepcao, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (!result.success) return res.status(404).json({ success: false, error: result.error });

    const tipoFech = (result.data?.tipo || '').toLowerCase();
    if (req.user?.tipo === 'recepcao' && tipoFech !== 'cliente') {
      return res.status(403).json({ success: false, error: 'Detalhe de fechamento financeiro do salão é admin-only.' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// POST /api/fechamentos — DUAS modalidades, com guards SEPARADOS.
// (A) FECHAMENTO POR CLIENTE (admin + recepção): { clienteId, atendimentoIds, vendaIds, formaPagamento, descontoGeral, creditoUtilizado, observacoes }
//     → Totais são RECALCULADOS pelo backend a partir dos IDs. Frontend NÃO pode injetar total.
//     → IDs são validados: pertencem ao salão E ao clienteId E não estão cancelados/já fechados.
// (B) FECHAMENTO FINANCEIRO DO SALÃO (admin-only): { data_inicio, data_fim, tipo }
//     → Agregação de período pelo FechamentoService.
//
// O handler discrimina pela presença de clienteId/atendimentoIds/vendaIds e aplica o guard certo.
router.post('/', authMiddleware, async (req, res) => {
  const b = req.body || {};
  const clienteId = b.clienteId ?? b.cliente_id ?? null;
  const atendimentoIds = b.atendimentoIds ?? b.atendimento_ids ?? null;
  const vendaIds = b.vendaIds ?? b.venda_ids ?? null;
  const isPerCliente = !!clienteId
    || (Array.isArray(atendimentoIds) && atendimentoIds.length > 0)
    || (Array.isArray(vendaIds) && vendaIds.length > 0);

  // Guard explícito por modo
  const role = req.user?.tipo;
  if (isPerCliente) {
    if (!['admin', 'recepcao'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Acesso restrito (admin ou recepção).' });
    }
    return _postFechamentoCliente(req, res, b, clienteId, atendimentoIds, vendaIds);
  }
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Fechamento financeiro do salão é admin-only.' });
  }
  return _postFechamentoPeriodo(req, res, b);
});

async function _postFechamentoCliente(req, res, b, clienteIdRaw, atendimentoIdsRaw, vendaIdsRaw) {
  try {
    const { pool, withTransaction } = require('../config/database');
    const profissionalId = b.profissionalId ?? b.profissional_id ?? null;
    const data = b.data || new Date().toISOString().slice(0, 10);
    const formaPagamento = b.formaPagamento ?? b.forma_pagamento ?? null;
    const observacoes = b.observacoes || null;
    // SOMENTE valores que o usuário escolhe explicitamente são aceitos do frontend.
    const descontoGeral = Math.max(0, Number(b.descontoGeral ?? b.desconto_geral ?? 0));
    const creditoUtilizadoSolicitado = Math.max(0, Number(b.creditoUtilizado ?? b.credito_utilizado ?? 0));
    const atIds = Array.isArray(atendimentoIdsRaw) ? [...new Set(atendimentoIdsRaw.map(Number).filter(Boolean))] : [];
    const vdIds = Array.isArray(vendaIdsRaw) ? [...new Set(vendaIdsRaw.map(Number).filter(Boolean))] : [];
    let clienteId = clienteIdRaw;

    if (!clienteId && atIds.length === 0 && vdIds.length === 0) {
      return res.status(400).json({ success: false, error: 'clienteId ou atendimentos/vendas obrigatórios' });
    }

    const result = await withTransaction(async (client) => {
      // 0) Se clienteId NÃO foi informado, deriva dos IDs: deve haver UM ÚNICO cliente.
      if (!clienteId) {
        const params = []; let p = 1;
        const parts = [];
        if (atIds.length) {
          parts.push(`SELECT cliente_id FROM atendimentos WHERE id = ANY($${p}::int[]) AND salao_id = $${p+1}`);
          params.push(atIds, req.salaoId); p += 2;
        }
        if (vdIds.length) {
          parts.push(`SELECT cliente_id FROM vendas WHERE id = ANY($${p}::int[]) AND salao_id = $${p+1}`);
          params.push(vdIds, req.salaoId); p += 2;
        }
        const r = await client.query(`SELECT DISTINCT cliente_id FROM (${parts.join(' UNION ALL ')}) t WHERE cliente_id IS NOT NULL`, params);
        if (r.rows.length === 0) {
          return { code: 400, body: { success: false, error: 'Nenhum cliente identificado nos itens informados.' } };
        }
        if (r.rows.length > 1) {
          return { code: 400, body: { success: false, error: 'Os itens pertencem a mais de um cliente — feche separadamente.' } };
        }
        clienteId = r.rows[0].cliente_id;
      }

      // 1) Tenancy do cliente (sempre — derivado ou explícito)
      const ok = await client.query('SELECT 1 FROM clientes WHERE id=$1 AND salao_id=$2', [clienteId, req.salaoId]);
      if (!ok.rows.length) return { code: 400, body: { success: false, error: 'cliente não pertence ao salão' } };

      // 2) Carrega + valida atendimentos. Backend RECALCULA total — nada vem do frontend.
      let totalAtend = 0;
      if (atIds.length > 0) {
        const r = await client.query(
          `SELECT id, cliente_id, status, COALESCE(valor, 0)::numeric AS valor
             FROM atendimentos
            WHERE id = ANY($1::int[]) AND salao_id = $2`,
          [atIds, req.salaoId]
        );
        if (r.rows.length !== atIds.length) {
          return { code: 400, body: { success: false, error: 'Atendimento(s) não encontrado(s) ou de outro salão.' } };
        }
        for (const a of r.rows) {
          if (clienteId && a.cliente_id !== Number(clienteId)) {
            return { code: 400, body: { success: false, error: `Atendimento ${a.id} não pertence ao cliente informado.` } };
          }
          if ((a.status || '').toLowerCase() === 'cancelado') {
            return { code: 400, body: { success: false, error: `Atendimento ${a.id} está cancelado.` } };
          }
        }
        // Já-fechado? procura em fechamentos.atendimento_ids
        const dup = await client.query(
          `SELECT id FROM fechamentos
            WHERE salao_id = $1 AND COALESCE(deleted_at, NULL) IS NULL
              AND atendimento_ids IS NOT NULL
              AND atendimento_ids && $2::int[]
            LIMIT 1`,
          [req.salaoId, atIds]
        );
        if (dup.rows.length) {
          return { code: 409, body: { success: false, error: `Algum atendimento já consta em fechamento prévio (#${dup.rows[0].id}).` } };
        }
        // Total = SOMA dos valores reais dos atendimentos (a coluna valor é atualizada pelo
        // endpoint de adicionar serviço, ver routes/atendimentos.js).
        totalAtend = r.rows.reduce((s, a) => s + Number(a.valor || 0), 0);
      }

      // 3) Carrega + valida vendas. Backend RECALCULA.
      let totalVendas = 0;
      if (vdIds.length > 0) {
        const r = await client.query(
          `SELECT id, cliente_id, status, COALESCE(valor_final, valor_total, 0)::numeric AS valor
             FROM vendas
            WHERE id = ANY($1::int[]) AND salao_id = $2`,
          [vdIds, req.salaoId]
        );
        if (r.rows.length !== vdIds.length) {
          return { code: 400, body: { success: false, error: 'Venda(s) não encontrada(s) ou de outro salão.' } };
        }
        for (const v of r.rows) {
          if (clienteId && v.cliente_id !== Number(clienteId)) {
            return { code: 400, body: { success: false, error: `Venda ${v.id} não pertence ao cliente informado.` } };
          }
          if (['cancelada', 'paga'].includes((v.status || '').toLowerCase())) {
            return { code: 400, body: { success: false, error: `Venda ${v.id} já está ${v.status}.` } };
          }
        }
        const dup = await client.query(
          `SELECT id FROM fechamentos
            WHERE salao_id = $1 AND COALESCE(deleted_at, NULL) IS NULL
              AND venda_ids IS NOT NULL
              AND venda_ids && $2::int[]
            LIMIT 1`,
          [req.salaoId, vdIds]
        );
        if (dup.rows.length) {
          return { code: 409, body: { success: false, error: `Alguma venda já consta em fechamento prévio (#${dup.rows[0].id}).` } };
        }
        totalVendas = r.rows.reduce((s, v) => s + Number(v.valor || 0), 0);
      }

      // 4) Crédito disponível do cliente (somatório histórico). Limita ao solicitado.
      let creditoAplicado = 0;
      if (creditoUtilizadoSolicitado > 0 && clienteId) {
        try {
          const credRow = await client.query(
            `SELECT COALESCE(
               SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END),
               0
             )::numeric AS saldo
             FROM creditos_cliente WHERE cliente_id = $1 AND salao_id = $2`,
            [clienteId, req.salaoId]
          );
          const saldo = Math.max(0, Number(credRow.rows[0]?.saldo || 0));
          creditoAplicado = Math.min(creditoUtilizadoSolicitado, saldo);
        } catch (_) { creditoAplicado = 0; }
      }

      const subTotal = totalAtend + totalVendas;
      const descontoAplicado = Math.min(descontoGeral, subTotal); // não desconta além do total
      const totalGeral = Math.max(0, subTotal - descontoAplicado - creditoAplicado);

      // 5) Insert fechamento
      const ins = await client.query(
        `INSERT INTO fechamentos
           (salao_id, cliente_id, profissional_id, data,
            total_atendimentos, total_vendas, total_produtos,
            desconto_geral, credito_utilizado, total_geral,
            forma_pagamento, observacoes, status,
            atendimento_ids, venda_ids, tipo, data_inicio, data_fim, total_liquido)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'fechado',
                 $13::int[],$14::int[],'cliente',$4,$4,$10)
         RETURNING id`,
        [req.salaoId, clienteId, profissionalId, data,
         totalAtend, totalVendas, 0,
         descontoAplicado, creditoAplicado, totalGeral,
         formaPagamento, observacoes,
         atIds.length ? atIds : null, vdIds.length ? vdIds : null]
      );
      const fechId = ins.rows[0].id;

      // 6) Marca atendimentos como finalizados
      if (atIds.length) {
        await client.query(
          `UPDATE atendimentos
              SET status = 'finalizado', updated_at = CURRENT_TIMESTAMP,
                  finalizado_em = COALESCE(finalizado_em, CURRENT_TIMESTAMP)
            WHERE id = ANY($1::int[]) AND salao_id = $2`,
          [atIds, req.salaoId]
        );
      }
      // 7) Marca vendas como pagas
      if (vdIds.length) {
        await client.query(
          `UPDATE vendas
              SET status = 'paga',
                  forma_pagamento = COALESCE($3, forma_pagamento),
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1::int[]) AND salao_id = $2`,
          [vdIds, req.salaoId, formaPagamento]
        );
      }
      // 8) Debita crédito utilizado (movimento real)
      if (creditoAplicado > 0 && clienteId) {
        await client.query(
          `INSERT INTO creditos_cliente (cliente_id, salao_id, tipo, valor, observacoes)
           VALUES ($1, $2, 'debito', $3, $4)`,
          [clienteId, req.salaoId, creditoAplicado, `Fechamento #${fechId}`]
        ).catch(() => { /* tabela legada — tolera */ });
      }

      return {
        code: 201,
        body: {
          success: true,
          data: {
            id: fechId,
            totalAtendimentos: totalAtend,
            totalVendas,
            descontoGeral: descontoAplicado,
            creditoUtilizado: creditoAplicado,
            totalGeral,
            formaPagamento,
          },
        },
      };
    });

    return res.status(result.code).json(result.body);
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro ao fechar conta", error);
  }
}

async function _postFechamentoPeriodo(req, res, b) {
  try {
    const dataInicio = b.data_inicio;
    const dataFim = b.data_fim;
    const tipo = b.tipo || 'diario';
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ success: false, error: 'data_inicio e data_fim obrigatórios para fechamento financeiro do salão' });
    }
    const di = new Date(dataInicio); const df = new Date(dataFim);
    if (Number.isNaN(di.getTime()) || Number.isNaN(df.getTime())) {
      return res.status(400).json({ success: false, error: 'Datas inválidas' });
    }
    if (df < di) return res.status(400).json({ success: false, error: 'data_fim deve ser >= data_inicio' });
    const diffDays = (df.getTime() - di.getTime()) / 86_400_000;
    if (diffDays > 365) return res.status(400).json({ success: false, error: 'Período máximo: 365 dias' });
    const hoje = new Date(); hoje.setUTCHours(23, 59, 59, 999);
    if (df.getTime() > hoje.getTime()) return res.status(400).json({ success: false, error: 'data_fim não pode estar no futuro' });
    if (!['diario', 'semanal', 'mensal'].includes(tipo)) {
      return res.status(400).json({ success: false, error: 'tipo deve ser diario, semanal ou mensal' });
    }

    const result = await service.gerar(req.salaoId, dataInicio, dataFim, tipo);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
}

// [P5-C5] requireAdmin + motivo obrigatório (B10) + audit log com before/after
router.put('/:id/reabrir', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const motivo = (req.body?.motivo || '').toString().trim();
    if (!motivo || motivo.length < 3) {
      return res.status(400).json({ success: false, error: 'motivo de reabertura obrigatório (mín 3 chars)' });
    }

    // Snapshot before
    const beforeRows = await pool.query(
      'SELECT * FROM fechamentos WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    const before = beforeRows.rows[0] || null;

    const result = await service.reabrir(req.params.id, req.salaoId);
    if (result.success) {
      // Persist motivo + auditor
      try {
        await pool.query(
          `UPDATE fechamentos SET motivo_reabertura = $1, reaberto_por = $2, reaberto_em = NOW()
           WHERE id = $3 AND salao_id = $4`,
          [motivo, req.user?.userId || req.user?.id || null, req.params.id, req.salaoId]
        );
      } catch (_) { /* coluna pode não existir em ambiente antigo */ }

      await logAction({
        req,
        action: 'fechamento.reabrir',
        entityType: 'fechamento',
        entityId: Number(req.params.id),
        before,
        after: { ...result.data, motivo_reabertura: motivo },
      });
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P5-C5] requireAdmin + soft-delete + motivo obrigatório + audit log
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const motivo = (req.body?.motivo || req.query?.motivo || '').toString().trim();
    if (!motivo || motivo.length < 3) {
      return res.status(400).json({ success: false, error: 'motivo de exclusão obrigatório (mín 3 chars)' });
    }

    const beforeRows = await pool.query(
      'SELECT * FROM fechamentos WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    if (beforeRows.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fechamento não encontrado' });
    }
    const before = beforeRows.rows[0];

    // Soft delete (preserve histórico)
    let softOk = false;
    try {
      const upd = await pool.query(
        `UPDATE fechamentos
            SET deleted_at = NOW(), deleted_by = $1, motivo_delete = $2
          WHERE id = $3 AND salao_id = $4 AND deleted_at IS NULL
          RETURNING id`,
        [req.user?.userId || req.user?.id || null, motivo, req.params.id, req.salaoId]
      );
      softOk = upd.rowCount > 0;
    } catch (_) { /* coluna pode não existir em ambiente antigo */ }

    if (!softOk) {
      // Fallback (não deveria ocorrer após migrations). NÃO faz hard-delete sem audit.
      await pool.query('DELETE FROM fechamentos WHERE id = $1 AND salao_id = $2', [req.params.id, req.salaoId]);
    }

    await logAction({
      req,
      action: softOk ? 'fechamento.soft_delete' : 'fechamento.hard_delete',
      entityType: 'fechamento',
      entityId: Number(req.params.id),
      before,
      after: { motivo_delete: motivo },
    });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
