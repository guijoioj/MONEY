const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { FechamentoService } = require('../services');
const { logAction } = require('../utils/auditLog');

const service = new FechamentoService();

// Fechamento financeiro: admin-only. (Fechar caixa do cliente, se existir como
// rota, deve viver em outro endpoint adminOrRecepcao.)
router.use(authMiddleware, requireRole('admin'));

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, tipo } = req.query;
    const result = await service.listar(req.salaoId, { status, tipo });
    res.json({ success: result.success, data: result.data || [] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Fechamentos em aberto: agrupa atendimentos + vendas em aberto por cliente.
// Frontend (pages/Fechamento.jsx) espera: [{ clienteId, clienteNome, clienteTelefone, atendimentos:[], vendas:[], totalGeral }]
router.get('/em-aberto', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { profissionalId, clienteId, clienteNome } = req.query;

    // Predicado: atendimento finalizado/concluido sem fechamento ainda. Filtros opcionais.
    const aParams = [req.salaoId];
    let aWhere = `a.salao_id = $1
      AND a.status IN ('finalizado','concluido','concluida')
      AND NOT EXISTS (
        SELECT 1 FROM fechamentos f
         WHERE f.salao_id = a.salao_id
           AND f.cliente_id = a.cliente_id
           AND COALESCE(f.deleted_at, NULL) IS NULL
           AND a.created_at::date BETWEEN f.data_inicio AND f.data_fim
      )`;
    let ap = 2;
    if (profissionalId) { aWhere += ` AND a.profissional_id = $${ap++}`; aParams.push(profissionalId); }
    if (clienteId)      { aWhere += ` AND a.cliente_id = $${ap++}`;      aParams.push(clienteId); }
    if (clienteNome)    { aWhere += ` AND c.nome ILIKE '%' || $${ap++} || '%'`; aParams.push(clienteNome); }

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

    // Vendas em aberto: status != cancelada, sem fechamento que cubra a data.
    const vParams = [req.salaoId];
    let vWhere = `v.salao_id = $1
      AND COALESCE(v.status,'concluida') != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM fechamentos f
         WHERE f.salao_id = v.salao_id
           AND f.cliente_id = v.cliente_id
           AND COALESCE(f.deleted_at, NULL) IS NULL
           AND v.created_at::date BETWEEN f.data_inicio AND f.data_fim
      )`;
    let vp = 2;
    if (profissionalId) { vWhere += ` AND v.profissional_id = $${vp++}`; vParams.push(profissionalId); }
    if (clienteId)      { vWhere += ` AND v.cliente_id = $${vp++}`;      vParams.push(clienteId); }
    if (clienteNome)    { vWhere += ` AND c.nome ILIKE '%' || $${vp++} || '%'`; vParams.push(clienteNome); }

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

    // Servicos por atendimento (uma só query)
    const atendIds = atendRes.rows.map(r => r.id).filter(Boolean);
    let servicosPorAtend = {};
    if (atendIds.length > 0) {
      try {
        const { rows: svcRows } = await pool.query(`
          SELECT asv.atendimento_id, s.id AS servico_id, s.nome AS servico_nome, asv.preco
            FROM atendimentos_servicos asv
            LEFT JOIN servicos s ON s.id = asv.servico_id
           WHERE asv.atendimento_id = ANY($1::text[])
        `, [atendIds]);
        svcRows.forEach(r => {
          const k = r.atendimento_id;
          if (!servicosPorAtend[k]) servicosPorAtend[k] = [];
          servicosPorAtend[k].push(r);
        });
      } catch (_) { /* tabela pode não existir em ambiente antigo */ }
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
           WHERE vi.venda_id = ANY($1::text[])
        `, [vendaIds]);
        itRows.forEach(r => {
          const k = r.venda_id;
          if (!itensPorVenda[k]) itensPorVenda[k] = [];
          itensPorVenda[k].push(r);
        });
      } catch (_) { /* noop */ }
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

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// POST /api/fechamentos — aceita DUAS modalidades:
//   (A) FECHAMENTO POR CLIENTE (caixa do cliente / Fechamento.jsx):
//       { clienteId, profissionalId, data, totalAtendimentos, totalVendas,
//         descontoGeral, totalGeral, formaPagamento, observacoes,
//         atendimentoIds:[], vendaIds:[], creditoUtilizado }
//   (B) FECHAMENTO FINANCEIRO DO SALÃO (admin period-based):
//       { data_inicio, data_fim, tipo }
// O handler discrimina pela presença de clienteId/cliente_id ou atendimentoIds.
router.post('/', authMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    // Normaliza camelCase → snake_case (frontend manda camel)
    const clienteId = b.clienteId ?? b.cliente_id ?? null;
    const atendimentoIds = b.atendimentoIds ?? b.atendimento_ids ?? null;
    const vendaIds = b.vendaIds ?? b.venda_ids ?? null;
    const isPerCliente = clienteId || (Array.isArray(atendimentoIds) && atendimentoIds.length > 0) || (Array.isArray(vendaIds) && vendaIds.length > 0);

    if (isPerCliente) {
      // ──────────── Modo (A): por cliente ────────────
      const { pool, withTransaction } = require('../config/database');
      const profissionalId = b.profissionalId ?? b.profissional_id ?? null;
      const data = b.data || new Date().toISOString().slice(0, 10);
      const formaPagamento = b.formaPagamento ?? b.forma_pagamento ?? null;
      const totalAtend = Number(b.totalAtendimentos ?? b.total_atendimentos ?? 0);
      const totalVendas = Number(b.totalVendas ?? b.total_vendas ?? 0);
      const totalProdutos = Number(b.totalProdutos ?? b.total_produtos ?? 0);
      const descontoGeral = Number(b.descontoGeral ?? b.desconto_geral ?? 0);
      const creditoUtilizado = Number(b.creditoUtilizado ?? b.credito_utilizado ?? 0);
      const totalGeral = Number(b.totalGeral ?? b.total_geral ?? 0);
      const observacoes = b.observacoes || null;
      const atIds = Array.isArray(atendimentoIds) ? atendimentoIds.map(Number).filter(Boolean) : [];
      const vdIds = Array.isArray(vendaIds) ? vendaIds.map(Number).filter(Boolean) : [];

      if (!clienteId && atIds.length === 0 && vdIds.length === 0) {
        return res.status(400).json({ success: false, error: 'clienteId ou atendimentos/vendas obrigatórios' });
      }

      const result = await withTransaction(async (client) => {
        // Validar tenancy do cliente
        if (clienteId) {
          const ok = await client.query('SELECT 1 FROM clientes WHERE id=$1 AND salao_id=$2', [clienteId, req.salaoId]);
          if (!ok.rows.length) return { code: 400, body: { success: false, error: 'cliente não pertence ao salão' } };
        }
        // Insert fechamento por cliente
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
           totalAtend, totalVendas, totalProdutos,
           descontoGeral, creditoUtilizado, totalGeral,
           formaPagamento, observacoes,
           atIds.length ? atIds : null, vdIds.length ? vdIds : null]
        );
        const fechId = ins.rows[0].id;

        // Marca atendimentos como finalizados
        if (atIds.length) {
          await client.query(
            `UPDATE atendimentos
                SET status = 'finalizado', updated_at = CURRENT_TIMESTAMP
              WHERE id = ANY($1::int[]) AND salao_id = $2`,
            [atIds, req.salaoId]
          );
        }
        // Marca vendas como pagas
        if (vdIds.length) {
          await client.query(
            `UPDATE vendas
                SET status = 'paga', forma_pagamento = COALESCE($3, forma_pagamento), updated_at = CURRENT_TIMESTAMP
              WHERE id = ANY($1::int[]) AND salao_id = $2`,
            [vdIds, req.salaoId, formaPagamento]
          );
        }
        // Debita crédito utilizado (se houver)
        if (creditoUtilizado > 0 && clienteId) {
          await client.query(
            `INSERT INTO creditos_cliente (cliente_id, salao_id, tipo, valor, observacoes)
             VALUES ($1, $2, 'debito', $3, $4)`,
            [clienteId, req.salaoId, creditoUtilizado, `Fechamento #${fechId}`]
          ).catch(() => { /* tabela pode não existir em ambiente legado */ });
        }
        return { code: 201, body: { success: true, data: { id: fechId, totalAtendimentos: totalAtend, totalVendas, totalGeral, descontoGeral, formaPagamento } } };
      });
      return res.status(result.code).json(result.body);
    }

    // ──────────── Modo (B): financeiro do salão por período ────────────
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
});

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
