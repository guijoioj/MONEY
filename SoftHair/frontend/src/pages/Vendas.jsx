import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendasAPI, clientesAPI, produtosAPI, servicosAPI, profissionaisAPI } from '../services/api';
import { Plus, X, ShoppingCart, Trash2, Eye, Pencil } from 'lucide-react';

const FORMA_PAGAMENTO_LABEL = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
};

export default function Vendas() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => { if (searchParams.get('new') === '1') { setIsModalOpen(true); setSearchParams({}); } }, []);
  const [viewVenda, setViewVenda] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    clienteId: '',
    vendedorId: '',
    data: new Date().toISOString().split('T')[0],
    formaPagamento: 'dinheiro',
    observacoes: '',
  });
  const [itens, setItens] = useState([]);
  const [filtroData, setFiltroData] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const queryClient = useQueryClient();

  const { data: vendas, isLoading } = useQuery({
    queryKey: ['vendas', filtroData, filtroDataInicio, filtroDataFim],
    queryFn: () => vendasAPI.getAll({ data: filtroData || undefined, dataInicio: filtroDataInicio || undefined, dataFim: filtroDataFim || undefined }),
  });

  const { data: clientesData } = useQuery({ queryKey: ['clientes-dropdown'], queryFn: () => clientesAPI.getAll({ limit: 1000 }) });
  const { data: produtosData } = useQuery({ queryKey: ['produtos-dropdown'], queryFn: () => produtosAPI.getAll({ ativo: true }) });
  const { data: servicosData } = useQuery({ queryKey: ['servicos-dropdown'], queryFn: () => servicosAPI.getAll({ ativo: true }) });
  const { data: profissionaisData } = useQuery({ queryKey: ['profissionais-dropdown'], queryFn: () => profissionaisAPI.getAll({ ativo: true }) });

  const createMutation = useMutation({
    mutationFn: (data) => vendasAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vendas']);
      queryClient.invalidateQueries(['produtos-dropdown']);
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => vendasAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vendas']);
      queryClient.invalidateQueries(['produtos-dropdown']);
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => vendasAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vendas']);
      queryClient.invalidateQueries(['produtos-dropdown']);
      queryClient.invalidateQueries(['fechamentos-em-aberto']);
      setDeleteConfirm(null);
    },
    onError: (err) => {
      console.error('Erro ao excluir venda:', err);
      alert(err.response?.data?.error || 'Erro ao excluir venda');
    },
  });

  const openModal = () => {
    setEditingId(null);
    setFormData({ clienteId: '', vendedorId: '', data: new Date().toISOString().split('T')[0], formaPagamento: 'dinheiro', observacoes: '' });
    setItens([]);
    setIsModalOpen(true);
  };

  const openEditModal = async (venda) => {
    try {
      const res = await vendasAPI.getById(venda.id);
      const v = res.data.data;
      setEditingId(v.id);
      setFormData({
        clienteId: v.clienteId || '',
        vendedorId: v.vendedorId || '',
        data: v.data,
        formaPagamento: v.formaPagamento || 'dinheiro',
        observacoes: v.observacoes || '',
      });
      setItens(v.itens.map(i => ({
        tipo: i.tipo,
        itemId: i.itemId,
        itemNome: i.itemNome,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        subtotal: i.subtotal,
      })));
      setIsModalOpen(true);
    } catch (err) {
      console.error('Erro ao carregar venda para edição:', err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setItens([]);
  };

  const viewVendaDetails = async (venda) => {
    try {
      const res = await vendasAPI.getById(venda.id);
      setViewVenda(res.data.data);
    } catch (err) {
      console.error('Erro ao carregar venda:', err);
    }
  };

  const addItem = (tipo, item) => {
    const precoUnitario = tipo === 'produto' ? item.precoVenda : item.preco;
    setItens(prev => [...prev, { tipo, itemId: item.id, itemNome: item.nome, quantidade: 1, precoUnitario, subtotal: precoUnitario }]);
  };

  const updateItemQuantity = (index, quantidade) => {
    setItens(prev => prev.map((item, i) =>
      i === index ? { ...item, quantidade, subtotal: quantidade * item.precoUnitario } : item
    ));
  };

  const removeItem = (index) => setItens(prev => prev.filter((_, i) => i !== index));

  const total = itens.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (itens.length === 0) { alert('Adicione pelo menos um item'); return; }

    const payload = {
      clienteId: formData.clienteId || null,
      vendedorId: formData.vendedorId || null,
      data: formData.data,
      total,
      formaPagamento: formData.formaPagamento,
      observacoes: formData.observacoes,
      itens,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('pt-BR');

  const profissionais = profissionaisData?.data?.data || [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Vendas</h1>
        <button onClick={openModal} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} /> Nova Venda
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Data específica</label>
            <input type="date" value={filtroData} onChange={(e) => { setFiltroData(e.target.value); setFiltroDataInicio(''); setFiltroDataFim(''); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <span className="text-gray-400 dark:text-gray-500">ou</span>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">De</label>
            <input type="date" value={filtroDataInicio} onChange={(e) => { setFiltroDataInicio(e.target.value); setFiltroData(''); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Até</label>
            <input type="date" value={filtroDataFim} onChange={(e) => { setFiltroDataFim(e.target.value); setFiltroData(''); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Vendedor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Pagamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {vendas?.data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhuma venda encontrada</td>
                </tr>
              ) : (
                vendas?.data?.data?.map((venda) => (
                  <tr key={venda.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 text-gray-800 dark:text-gray-100">{formatDate(venda.data)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{venda.clienteNome || 'Consumidor Final'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{venda.vendedorNome || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{FORMA_PAGAMENTO_LABEL[venda.formaPagamento] || '-'}</td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(venda.total)}</td>
                    <td className="px-6 py-4 flex items-center gap-1">
                      <button onClick={() => viewVendaDetails(venda)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded" title="Ver detalhes">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => openEditModal(venda)} className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:bg-yellow-900/30 rounded" title="Editar">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => setDeleteConfirm(venda)} className="p-2 text-red-500 hover:bg-red-50 dark:bg-red-900/30 rounded" title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar/Editar Venda */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="text-indigo-600 dark:text-indigo-400" />
                {editingId ? 'Editar Venda' : 'Nova Venda'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cliente</label>
                  <select value={formData.clienteId} onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Consumidor Final</option>
                    {clientesData?.data?.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Vendedor</label>
                  <select value={formData.vendedorId} onChange={(e) => setFormData({ ...formData, vendedorId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Sem vendedor</option>
                    {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
                  <input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Observações</label>
                  <input type="text" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Opcional" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Adicionar Itens</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">Produtos</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {produtosData?.data?.data?.filter(p => p.estoque > 0).map((produto) => (
                        <button key={produto.id} type="button" onClick={() => addItem('produto', produto)}
                          className="w-full text-left px-3 py-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-sm">
                          {produto.nome} — {formatCurrency(produto.precoVenda)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">Serviços</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {servicosData?.data?.data?.map((servico) => (
                        <button key={servico.id} type="button" onClick={() => addItem('servico', servico)}
                          className="w-full text-left px-3 py-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-sm">
                          {servico.nome} — {formatCurrency(servico.preco)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Itens da Venda</h3>
                {itens.length === 0 ? (
                  <p className="text-center py-4 text-gray-400 dark:text-gray-500">Nenhum item adicionado</p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {itens.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 dark:text-gray-100">{item.itemNome}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatCurrency(item.precoUnitario)} cada</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="number" min="1" value={item.quantidade}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center" />
                          <span className="font-medium w-20 text-right">{formatCurrency(item.subtotal)}</span>
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-xl font-bold mb-4">
                  <span>Total:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(total)}</span>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    Cancelar
                  </button>
                  <button type="submit"
                    disabled={(editingId ? updateMutation.isPending : createMutation.isPending) || itens.length === 0}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {editingId
                      ? (updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações')
                      : (createMutation.isPending ? 'Salvando...' : 'Registrar Venda')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalhes */}
      {viewVenda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Detalhes da Venda</h2>
              <button onClick={() => setViewVenda(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={24} /></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Data</p><p className="font-medium">{formatDate(viewVenda.data)}</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Cliente</p><p className="font-medium">{viewVenda.clienteNome || 'Consumidor Final'}</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Vendedor</p><p className="font-medium">{viewVenda.vendedorNome || '—'}</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Forma de Pagamento</p><p className="font-medium">{FORMA_PAGAMENTO_LABEL[viewVenda.formaPagamento] || '—'}</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total</p><p className="font-bold text-xl text-indigo-600 dark:text-indigo-400">{formatCurrency(viewVenda.total)}</p></div>
              </div>
              <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Itens</h3>
              <div className="border rounded-lg divide-y">
                {viewVenda.itens?.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{item.itemNome}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{item.quantidade}x {formatCurrency(item.precoUnitario)}</p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>
              {viewVenda.observacoes && (
                <div className="mt-4"><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Observações</p><p className="text-gray-700 dark:text-gray-200">{viewVenda.observacoes}</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Excluir Venda</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-1">
              Venda de <span className="font-medium">{formatDate(deleteConfirm.data)}</span> —&nbsp;
              <span className="font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(deleteConfirm.total)}</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">
              O estoque dos produtos será restaurado automaticamente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                Cancelar
              </button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
