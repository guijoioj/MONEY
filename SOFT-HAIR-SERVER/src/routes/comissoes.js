const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { isProfissionalScope } = require('../middleware/role');
const { ComissaoService } = require('../services');

const service = new ComissaoService();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { pago, data_inicio, data_fim } = req.query;
    // Scoping: profissional só vê as próprias comissões.
    let profissional_id = req.query.profissional_id;
    if (isProfissionalScope(req)) {
      if (!req.user.profissionalId) {
        return res.status(403).json({ success: false, error: 'Usuário profissional sem vínculo. Contate o administrador.' });
      }
      profissional_id = req.user.profissionalId;
    }
    const result = await service.listar(req.salaoId, { profissional_id, pago, data_inicio, data_fim });
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Comissões pagas — profissional só vê as próprias.
router.get('/pagas', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const params = [req.salaoId];
    let where = 'cp.salao_id = $1';
    if (isProfissionalScope(req)) {
      if (!req.user.profissionalId) {
        return res.status(403).json({ success: false, error: 'Usuário profissional sem vínculo. Contate o administrador.' });
      }
      where += ' AND cp.profissional_id = $2';
      params.push(req.user.profissionalId);
    }
    const { rows } = await pool.query(
      `SELECT cp.*, p.nome AS profissional_nome
       FROM comissoes_pagas cp
       LEFT JOIN profissionais p ON p.id = cp.profissional_id
       WHERE ${where}
       ORDER BY cp.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// Comissões estornadas — profissional só vê as próprias.
router.get('/estornos', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const params = [req.salaoId];
    let where = 'ce.salao_id = $1';
    if (isProfissionalScope(req)) {
      if (!req.user.profissionalId) {
        return res.status(403).json({ success: false, error: 'Usuário profissional sem vínculo. Contate o administrador.' });
      }
      where += ' AND ce.profissional_id = $2';
      params.push(req.user.profissionalId);
    }
    const { rows } = await pool.query(
      `SELECT ce.*, p.nome AS profissional_nome
       FROM comissoes_estornos ce
       LEFT JOIN profissionais p ON p.id = ce.profissional_id
       WHERE ${where}
       ORDER BY ce.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// Pagar comissões (em lote)
// [P3-C3] requireAdmin + transação idempotente + reconciliação de valor.
// - Apenas admin pode pagar comissões.
// - UPDATE só marca comissões com pago=false (idempotente em re-execuções).
// - Valor real = SUM(valor_comissao) das efetivamente marcadas; rejeita pagamento
//   com discrepância > 1 centavo se valor for fornecido.
router.post('/pagar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { withTransaction } = require('../config/database');
    const { profissional_id, profissionalId, valor, observacoes, comissoes } = req.body;
    const pid = profissional_id || profissionalId;
    if (!pid) {
      return res.status(400).json({ success: false, error: 'profissional_id obrigatório' });
    }
    if (!Array.isArray(comissoes) || comissoes.length === 0) {
      return res.status(400).json({ success: false, error: 'comissoes (array de IDs) obrigatório' });
    }

    const result = await withTransaction(async (client) => {
      // [P3-C3] Validar profissional pertence ao salão
      const profOk = await client.query(
        'SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2',
        [pid, req.salaoId]
      );
      if (!profOk.rows.length) {
        return { code: 403, body: { success: false, error: 'profissional_id não pertence ao salão' } };
      }

      // [P3-C3] UPDATE idempotente: só marca quem ainda não foi pago E pertence ao salão.
      // RETURNING valor_comissao traz apenas as efetivamente alteradas nesta transação.
      const updated = await client.query(
        `UPDATE comissoes
            SET pago = true, updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[])
            AND salao_id = $2
            AND profissional_id = $3
            AND COALESCE(pago, false) = false
        RETURNING id, valor_comissao`,
        [comissoes, req.salaoId, pid]
      );

      if (updated.rows.length === 0) {
        return { code: 409, body: { success: false, error: 'Nenhuma comissão pendente para pagar (já pagas ou inexistentes)' } };
      }

      const valorReal = updated.rows.reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);

      // [P3-C3] Reconciliação: se cliente passou valor, deve bater (tolerância 1 centavo)
      if (valor !== undefined && valor !== null && Math.abs(Number(valor) - valorReal) > 0.01) {
        // força rollback lançando erro
        throw new Error(`Valor informado (${Number(valor).toFixed(2)}) não bate com a soma das comissões (${valorReal.toFixed(2)})`);
      }

      const ids = updated.rows.map(r => r.id);
      const inserted = await client.query(
        `INSERT INTO comissoes_pagas (salao_id, profissional_id, valor, observacoes, comissoes_ids)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.salaoId, pid, valorReal, observacoes || null, ids]
      );

      // [P3-C3] Audit log (console) + [P5-C2] audit_log persistente
      console.log(`[COMISSOES][AUDIT][PAGAR] salao=${req.salaoId} user=${req.user?.userId} prof=${pid} valor=${valorReal.toFixed(2)} ids=[${ids.join(',')}]`);
      const { logAction } = require('../utils/auditLog');
      await logAction({
        req,
        action: 'comissao.pagar_batch',
        entityType: 'comissoes_pagas',
        entityId: inserted.rows[0]?.id,
        after: { profissional_id: pid, valor: valorReal, comissoes_ids: ids },
      });

      return { code: 201, body: { success: true, data: inserted.rows[0] } };
    });

    return res.status(result.code).json(result.body);
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Estornar comissão
// [P3-C3] Mesmo padrão: requireAdmin + transação + audit.
router.post('/estornar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { fechamento_id, fechamentoId, motivo, valor, profissional_id, profissionalId } = req.body;
    const fid = fechamento_id || fechamentoId;
    const pid = profissional_id || profissionalId;

    // [P3-C3] Se profissional informado, validar tenancy
    if (pid) {
      const profOk = await pool.query(
        'SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2',
        [pid, req.salaoId]
      );
      if (!profOk.rows.length) {
        return res.status(403).json({ success: false, error: 'profissional_id não pertence ao salão' });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO comissoes_estornos (salao_id, fechamento_id, profissional_id, valor, motivo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.salaoId, fid || null, pid || null, valor || 0, motivo || null]
    );
    console.log(`[COMISSOES][AUDIT][ESTORNAR] salao=${req.salaoId} user=${req.user?.userId} prof=${pid || 'null'} valor=${valor || 0}`);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

router.get('/resumo/:profissionalId', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ success: false, error: 'data_inicio e data_fim obrigatórios' });
    const result = await service.resumoPorProfissional(req.salaoId, req.params.profissionalId, data_inicio, data_fim);
    res.json({ success: result.success, data: result.data });
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

// [P5-C3] requireAdmin + validação de tenancy + audit log
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const { profissional_id, venda_id } = req.body;
    if (!profissional_id) {
      return res.status(400).json({ success: false, error: 'profissional_id obrigatório' });
    }

    // Validar profissional pertence ao salão
    const profOk = await pool.query(
      'SELECT id, comissao_percentual FROM profissionais WHERE id = $1 AND salao_id = $2',
      [profissional_id, req.salaoId]
    );
    if (!profOk.rows.length) {
      return res.status(403).json({ success: false, error: 'profissional_id não pertence ao salão' });
    }

    // Validar venda pertence ao salão (se informada)
    if (venda_id) {
      const vendaOk = await pool.query(
        'SELECT id, valor_final FROM vendas WHERE id = $1 AND salao_id = $2',
        [venda_id, req.salaoId]
      );
      if (!vendaOk.rows.length) {
        return res.status(403).json({ success: false, error: 'venda_id não pertence ao salão' });
      }
    }

    const result = await service.criar(req.body, req.salaoId);
    if (result.success) {
      const { logAction } = require('../utils/auditLog');
      await logAction({
        req,
        action: 'comissao.criar',
        entityType: 'comissao',
        entityId: result.data?.id,
        after: result.data,
      });
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// [P5-C3] requireAdmin + audit log
router.put('/:id/pagar', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../config/database');
    // Snapshot before
    const before = await pool.query(
      'SELECT * FROM comissoes WHERE id = $1 AND salao_id = $2',
      [req.params.id, req.salaoId]
    );
    const result = await service.marcarComoPaga(req.params.id, req.salaoId);
    if (result.success) {
      const { logAction } = require('../utils/auditLog');
      await logAction({
        req,
        action: 'comissao.pagar_individual',
        entityType: 'comissao',
        entityId: Number(req.params.id),
        before: before.rows[0] || null,
        after: result.data,
      });
      res.json({ success: true, data: result.data, message: result.message });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
