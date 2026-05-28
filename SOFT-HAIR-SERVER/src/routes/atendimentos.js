const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { isProfissionalScope, requireAnyRole } = require('../middleware/role');
const { AtendimentoService } = require('../services');

const service = new AtendimentoService();

// Atendimentos:
//   GET → todos os 3 roles (profissional scopado via isProfissionalScope)
//   POST/PUT → admin + recepção
//   DELETE → admin-only via requireAdmin individual.
const writeGuard = requireAnyRole(['admin', 'recepcao']);

// Listar
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, data_inicio, data_fim, limit } = req.query;
    // Scoping: profissional só vê os próprios.
    let profissional_id = req.query.profissional_id;
    if (isProfissionalScope(req)) {
      if (!req.user.profissionalId) {
        return res.status(403).json({ success: false, error: 'Usuário profissional sem vínculo. Contate o administrador.' });
      }
      profissional_id = req.user.profissionalId;
    }
    const result = await service.listar(req.salaoId, { status, profissional_id, data_inicio, data_fim, limit });
    res.json({ success: result.success, data: result.data || [], error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Buscar por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await service.buscarPorId(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Criar
router.post('/', authMiddleware, writeGuard, [
  // IDs são TEXT (UUID/string) no schema → não usar isInt
  body('cliente_id').exists({ checkFalsy: true }).withMessage('cliente_id é obrigatório'),
  body('profissional_id').exists({ checkFalsy: true }).withMessage('profissional_id é obrigatório'),
  body('servico_id').optional({ nullable: true }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.criar(req.body, req.salaoId);
    if (result.success) res.status(201).json({ success: true, data: result.data });
    else res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// Atualizar
// [P8-A2] requireAdmin + validator isIn + state machine (service-level)
// PUT: admin + recepção (finalizar, alterar status do atendimento).
router.put('/:id', authMiddleware, writeGuard, [
  body('status').optional().isIn(['agendado', 'em_andamento', 'finalizado', 'cancelado'])
    .withMessage('Status inválido (use: agendado, em_andamento, finalizado, cancelado)'),
  body('observacoes').optional().isString().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await service.atualizar(req.params.id, req.body, req.salaoId, { req });
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const code = /Transição inválida|Status inválido|imutável/i.test(result.error || '') ? 400 : 404;
      res.status(code).json({ success: false, error: result.error });
    }
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO ATENDIMENTO ABERTO — adicionar / listar / remover serviços do atendimento.
// Regras:
//   - admin/recepção: pode mexer em qualquer atendimento do salão
//   - profissional: SÓ no próprio atendimento, e SÓ se status='em_andamento'
// Tabela: atendimentos_servicos (snapshot de nome/valor/comissao preservado).
// ─────────────────────────────────────────────────────────────────────────────

// Helper: carrega atendimento + valida tenancy + escopo profissional.
async function _loadAtendimentoForWrite(req, res) {
  const { pool } = require('../config/database');
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'ID inválido' });
    return null;
  }
  const { rows } = await pool.query(
    `SELECT a.id, a.salao_id, a.profissional_id, a.cliente_id, a.status
       FROM atendimentos a
      WHERE a.id = $1 AND a.salao_id = $2`,
    [id, req.salaoId]
  );
  if (!rows.length) {
    res.status(404).json({ success: false, error: 'Atendimento não encontrado' });
    return null;
  }
  const at = rows[0];
  if (req.user?.tipo === 'profissional') {
    if (req.user.profissionalId !== at.profissional_id) {
      res.status(403).json({ success: false, error: 'Atendimento não pertence a você' });
      return null;
    }
    if (!['em_andamento', 'aberto'].includes((at.status || '').toLowerCase())) {
      res.status(400).json({ success: false, error: 'Atendimento já finalizado — não é possível alterar' });
      return null;
    }
  }
  return at;
}

// GET lista serviços do atendimento
router.get('/:id/servicos', authMiddleware, async (req, res) => {
  try {
    const at = await _loadAtendimentoForWrite(req, res);
    if (!at) return;
    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      `SELECT asv.id, asv.servico_id, asv.nome_snapshot, asv.valor_snapshot,
              asv.quantidade, asv.subtotal,
              asv.percentual_comissao_snapshot, asv.valor_comissao,
              asv.observacao, asv.created_at, u.nome AS criado_por_nome
         FROM atendimentos_servicos asv
         LEFT JOIN usuarios u ON u.id = asv.criado_por
        WHERE asv.atendimento_id = $1
        ORDER BY asv.created_at ASC`,
      [at.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro ao listar serviços", error);
  }
});

// POST adiciona serviço ao atendimento (snapshot de nome/valor/comissao)
router.post('/:id/servicos', authMiddleware, [
  body('servico_id').exists({ checkFalsy: true }).withMessage('servico_id é obrigatório'),
  body('quantidade').optional().isInt({ min: 1, max: 100 }),
  body('observacao').optional().isString().isLength({ max: 500 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const at = await _loadAtendimentoForWrite(req, res);
    if (!at) return;

    const { pool, withTransaction } = require('../config/database');
    const servicoRow = await pool.query(
      `SELECT id, nome, preco, comissao_percentual FROM servicos
        WHERE id = $1 AND salao_id = $2 AND COALESCE(ativo, true) = true`,
      [req.body.servico_id, req.salaoId]
    );
    if (!servicoRow.rows.length) {
      return res.status(400).json({ success: false, error: 'Serviço não encontrado ou inativo' });
    }
    const svc = servicoRow.rows[0];
    const quantidade = Number(req.body.quantidade || 1);
    const valor = Number(svc.preco || 0);
    const subtotal = +(valor * quantidade).toFixed(2);
    const pctComissao = Number(svc.comissao_percentual || 0);
    const valorComissao = +(subtotal * pctComissao / 100).toFixed(2);

    const result = await withTransaction(async (client) => {
      // Insere item
      const ins = await client.query(
        `INSERT INTO atendimentos_servicos
           (atendimento_id, servico_id, profissional_id, salao_id,
            nome_snapshot, valor_snapshot, quantidade, subtotal,
            percentual_comissao_snapshot, valor_comissao,
            observacao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [at.id, svc.id, at.profissional_id, req.salaoId,
         svc.nome, valor, quantidade, subtotal,
         pctComissao, valorComissao,
         req.body.observacao || null, req.user?.userId || null]
      );
      // Recalcula total do atendimento somando todos os itens
      const tot = await client.query(
        `SELECT COALESCE(SUM(subtotal), 0)::numeric AS total
           FROM atendimentos_servicos WHERE atendimento_id = $1`,
        [at.id]
      );
      const novoTotal = Number(tot.rows[0].total);
      await client.query(
        `UPDATE atendimentos SET valor = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [novoTotal, at.id]
      );
      return { item: ins.rows[0], novo_total: novoTotal };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro ao adicionar serviço", error);
  }
});

// DELETE remove serviço do atendimento (mesmo escopo profissional)
router.delete('/:id/servicos/:itemId', authMiddleware, async (req, res) => {
  try {
    const at = await _loadAtendimentoForWrite(req, res);
    if (!at) return;
    const { pool, withTransaction } = require('../config/database');

    const result = await withTransaction(async (client) => {
      const del = await client.query(
        `DELETE FROM atendimentos_servicos
          WHERE id = $1 AND atendimento_id = $2 AND salao_id = $3
          RETURNING id`,
        [req.params.itemId, at.id, req.salaoId]
      );
      if (!del.rowCount) return null;
      const tot = await client.query(
        `SELECT COALESCE(SUM(subtotal), 0)::numeric AS total
           FROM atendimentos_servicos WHERE atendimento_id = $1`,
        [at.id]
      );
      const novoTotal = Number(tot.rows[0].total);
      await client.query(
        `UPDATE atendimentos SET valor = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [novoTotal, at.id]
      );
      return { novo_total: novoTotal };
    });

    if (!result) return res.status(404).json({ success: false, error: 'Item não encontrado' });
    res.json({ success: true, data: result });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro ao remover serviço", error);
  }
});

// Deletar
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await service.deletar(req.params.id, req.salaoId);
    if (result.success) res.json({ success: true, message: result.message });
    else res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    require("../utils/sendError").sendError(res, 500, "Erro interno", error);
  }
});

module.exports = router;
