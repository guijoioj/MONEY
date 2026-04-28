const express = require('express');
const router = express.Router();
const PedidoLoja = require('../../models/PedidoLoja');
const Produto = require('../../models/Produto');
const Venda = require('../../models/Venda');
const Cliente = require('../../models/Cliente');
const ClienteApp = require('../../models/ClienteApp');
const { appAuthMiddleware } = require('../../middleware/appAuth');
const { authMiddleware } = require('../../middleware/auth');
const ws = require('../../services/websocketService');
const { queryOne } = require('../../config/database');

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

router.get('/saloes/:salonId/produtos', async (req, res) => {
  try {
    const produtos = await Produto.getAll({ ativo: true, ...req.query }, req.params.salonId);
    res.json({ data: produtos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pedido', appAuthMiddleware, async (req, res) => {
  try {
    const { salonId, itens, enderecoEntrega, formaPagamento, observacoes } = req.body;
    if (!salonId || !itens?.length) return res.status(400).json({ error: 'salonId e itens são obrigatórios' });

    // Compute total server-side from DB prices to prevent client-side manipulation
    let total = 0;
    for (const item of itens) {
      const produto = await queryOne('SELECT preco FROM produtos WHERE id = ?', [item.produtoId]);
      if (!produto) return res.status(400).json({ error: `Produto ${item.produtoId} não encontrado` });
      total += produto.preco * item.quantidade;
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
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/meus-pedidos', appAuthMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoLoja.getByCliente(req.clienteApp.clienteAppId) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pedidos', authMiddleware, async (req, res) => {
  try { res.json({ data: await PedidoLoja.getBySalao(req.salonId, req.query) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pedidos/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const statusValidos = ['pendente', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'];
    if (!statusValidos.includes(status)) return res.status(400).json({ error: `Status inválido. Use: ${statusValidos.join(', ')}` });
    const pedido = await PedidoLoja.atualizarStatus(req.params.id, req.salonId, status);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    ws.notificarCliente(pedido.clienteAppId, {
      tipo: 'status_pedido_loja',
      titulo: 'Atualização do seu pedido',
      mensagem: `Seu pedido está: ${status}`,
      pedido
    });
    res.json(pedido);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
