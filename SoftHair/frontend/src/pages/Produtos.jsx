import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { produtosAPI } from '../services/api';
import { Search, Plus, Edit2, Trash2, X, Package, AlertTriangle, AlertCircle } from 'lucide-react';

export default function Produtos() {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estoqueBaixo, setEstoqueBaixo] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, produto: null });
  const [formData, setFormData] = useState({ nome: '', descricao: '', marca: '', categoria: '', precoCusto: '', precoVenda: '', estoque: 0, estoqueMinimo: 0, unidade: 'un', ativo: true });

  const { data, isLoading } = useQuery({
    queryKey: ['produtos', search, categoria, estoqueBaixo],
    queryFn: () => produtosAPI.getAll({ search, categoria, estoqueBaixo: estoqueBaixo || undefined }),
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => produtosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['produtos']);
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => produtosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['produtos']);
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => produtosAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['produtos']);
      setDeleteModal({ open: false, produto: null });
    },
  });

  const openModal = (produto = null) => {
    if (produto) {
      setEditingProduto(produto);
      setFormData(produto);
    } else {
      setEditingProduto(null);
      setFormData({ nome: '', descricao: '', marca: '', categoria: '', precoCusto: '', precoVenda: '', estoque: 0, estoqueMinimo: 0, unidade: 'un', ativo: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduto(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProduto) {
      updateMutation.mutate({ id: editingProduto.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (produto) => {
    setDeleteModal({ open: true, produto });
  };

  const confirmDelete = () => {
    if (deleteModal.produto) {
      deleteMutation.mutate(deleteModal.produto.id);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Produtos</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Produto
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas categorias</option>
            {data?.data?.categorias?.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={() => setEstoqueBaixo(!estoqueBaixo)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${estoqueBaixo ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 text-yellow-700' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'}`}
          >
            <AlertTriangle size={18} />
            Estoque Baixo
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Produto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Marca</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Custo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Venda</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Estoque</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                data?.data?.data?.map((produto) => (
                  <tr key={produto.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 ${!produto.ativo ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                          <Package className="text-indigo-600 dark:text-indigo-400" size={20} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">{produto.nome}</div>
                          {produto.descricao && <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate max-w-xs">{produto.descricao}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{produto.marca || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{produto.categoria || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(produto.precoCusto)}</td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(produto.precoVenda)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${produto.estoque <= produto.estoqueMinimo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {produto.estoque <= produto.estoqueMinimo && <AlertTriangle size={14} />}
                        {produto.estoque} / {produto.estoqueMinimo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(produto)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteClick(produto)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingProduto ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Marca</label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Preço Custo</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precoCusto}
                    onChange={(e) => setFormData({ ...formData, precoCusto: parseFloat(e.target.value) || '' })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Preço Venda *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precoVenda}
                    onChange={(e) => setFormData({ ...formData, precoVenda: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Estoque</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estoque}
                    onChange={(e) => setFormData({ ...formData, estoque: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Unidade</label>
                  <select
                    value={formData.unidade}
                    onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="un">un</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estoqueMinimo}
                    onChange={(e) => setFormData({ ...formData, estoqueMinimo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="ativo" className="text-sm text-gray-700 dark:text-gray-200">Produto ativo</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">Confirmar Exclusão</h2>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
                Tem certeza que deseja excluir o produto <strong>{deleteModal.produto?.nome}</strong>?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ open: false, produto: null })}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
