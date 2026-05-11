const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const PedidoLoja = require('../../models/PedidoLoja');
const Produto = require('../../models/Produto');
const Venda = require('../../models/Venda');
const Cliente = require('../../models/Cliente');
const ClienteApp = require('../../models/ClienteApp');
const { appAuthMiddleware } = require('../../middleware/appAuth');
const { authMiddleware } = require('../../middleware/auth');
const ws = require('../../services/websocketService');
const { queryOne, pool } = require('../../config/database');

// [P2-C3] Rate-limit dedicado para enumeração pública de produtos.
const publicProdutosLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function resolverOuCriarCliente(clienteAppId, salonId) {
  const clienteApp = await ClienteApp.findById(clienteAppId);
  if (!clienteApp) return null;
  const existentes = await Cliente.getAll({ search: clienteApp.email }, salonId);
  if (existentes.length) return existentes[0].id;
  const novo = await Cliente.create({
    nome: clienteApp.nome,
    email: clienteApp.email,
    telefone: clienteApp.telefone || '',
    observacoes: 'Vinculado via app mobile'
  }, salonId);
  return novo?.id ?? null;
}

// [P2-C3] Endpoint público (cliente do app PODE listar sem login p/ onboarding),
// MAS: rate-limited e campos sensíveis (preco_custo, quantidade_estoque exata) NÃO são expostos.
router.get('/saloes/:salonId/produtos', publicProdutosLimiter, async (req, res) => {
  try {
    const produtos = await Produto.getAll({ ativo: true, ...req.query }, req.params.salonId);
    const publicProdutos = produtos.map(p => ({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      preco_venda: p.preco_venda,
      foto_url: p.foto_url,
      categoria: p.categoria,
      em_estoque: (p.quantidade_estoque || 0) > 0,
      ativo: p.ativo,
    }));
    res.json({ data: publicProdutos });
  } catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

router.post('/pedido', appAuthMiddleware, async (req, res) => {
  try {
    const { salonId, itens, enderecoEntrega, formaPagamento, observacoes } = req.body;
    if (!salonId || !itens?.length) return res.status(400).json({ error: 'salonId e itens são obrigatórios' });

    // [P2-M4 / P3-M3] Validar quantidade — inteiro positivo com upper bound 10000 (bloqueia DoS/overflow).
    for (const item of itens) {
      const qtd = Number(item.quantidade);
      if (!Number.isInteger(qtd) || qtd <= 0 || qtd > 10000) {
        return res.status(400).json({ error: `Quantidade inválida (1..10000) para produto ${item.produtoId}` });
      }
      item.quantidade = qtd;
    }

    // [P2-C2] Server-side pricing FILTRADO por salao_id — impede cross-tenant pricing.
    // Cliente não pode mais usar produto de outro salão para forjar preço.
    let total = 0;
    for (const item of itens) {
      const produto = await queryOne(
        'SELECT preco_venda FROM produtos WHERE id = $1 AND salao_id = $2 AND ativo = true',
        [item.produtoId, salonId]
      );
      if (!produto) return res.status(400).json({ error: `Produto ${item.produtoId} não encontrado neste salão` });
      const precoUnitario = Number(produto.preco_venda);
      item.precoUnitario = precoUnitario;
      item.subtotal = precoUnitario * item.quantidade;
      total += item.subtotal;
    }
    const pedido = await PedidoLoja.create(
      { salonId, clienteAppId: req.clienteApp.clienteAppId, total, enderecoEntrega, formaPagamento, observacoes },
      itens
    );

    try {
      const clienteId = await resolverOuCriarCliente(req.clienteApp.clienteAppId, salonId);
      await Venda.create(
        {
          clienteId,
          data: new Date().toISOString().split('T')[0],
          total,
          formaPagamento: formaPagamento || null,
          observacoes: `Pedido app #${pedido.id.slice(0, 8)}${enderecoEntrega ? ` — entrega: ${enderecoEntrega}` : ''}`,
        },
        itens.map(i => ({
          tipo: 'produto',
          itemId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          subtotal: i.subtotal,
        })),
        salonId
      );
    } catch (errVenda) {
      console.error('Erro ao criar venda a partir do pedido app:', errVenda.message);
    }

    ws.notificarSalao(salonId, {
      tipo: 'novo_pedido_loja',
      titulo: 'Novo pedido na loja',
      mensagem: `${req.clienteApp.nome} fez um pedido de R$ ${total.toFixed(2)}`,
      pedido
    });
    res.status(201).json(pedido);
  } catch (e) { require("../../utils/sendError").sendError(res, 400, "Requisição inválida", e); }
});

router.get('/meus-pedidos', appAuthMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoLoja.getByCliente(req.clienteApp.clienteAppId) }); }
  catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

router.get('/pedidos', authMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoLoja.getBySalao(req.salaoId, req.query) }); }
  catch (e) { require("../../utils/sendError").sendError(res, 500, "Erro interno", e); }
});

router.put('/pedidos/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const statusValidos = ['pendente', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'];
    if (!statusValidos.includes(status)) return res.status(400).json({ error: `Status inválido. Use: ${statusValidos.join(', ')}` });
    const pedido = await PedidoLoja.atualizarStatus(req.params.id, req.salaoId, status);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    ws.notificarCliente(pedido.clienteAppId, {
      tipo: 'status_pedido_loja',
      titulo: 'Atualização do seu pedido',
      mensagem: `Seu pedido está: ${status}`,
      pedido
    });
    res.json(pedido);
  } catch (e) { require("../../utils/sendError").sendError(res, 400, "Requisição inválida", e); }
});

module.exports = router;
