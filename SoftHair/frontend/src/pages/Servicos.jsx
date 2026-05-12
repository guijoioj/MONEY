import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicosAPI } from '../services/api';
import { Search, Plus, Edit2, Trash2, X, Clock, DollarSign, AlertCircle } from 'lucide-react';

export default function Servicos() {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, servico: null });
  const [formData, setFormData] = useState({ nome: '', descricao: '', duracao: 30, preco: '', categoria: '', ativo: true });

  const { data, isLoading } = useQuery({
    queryKey: ['servicos', search, categoria],
    queryFn: () => servicosAPI.getAll({ search, categoria }),
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => servicosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['servicos']);
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => servicosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['servicos']);
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => servicosAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['servicos']);
      setDeleteModal({ open: false, servico: null });
    },
  });

  const openModal = (servico = null) => {
    if (servico) {
      setEditingServico(servico);
      setFormData(servico);
    } else {
      setEditingServico(null);
      setFormData({ nome: '', descricao: '', duracao: 30, preco: '', categoria: '', ativo: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingServico(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingServico) {
      updateMutation.mutate({ id: editingServico.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (servico) => {
    setDeleteModal({ open: true, servico });
  };

  const confirmDelete = () => {
    if (deleteModal.servico) {
      deleteMutation.mutate(deleteModal.servico.id);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Serviços</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Serviço
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar serviços..."
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
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.data?.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Nenhum serviço encontrado
            </div>
          ) : (
            data?.data?.data?.map((servico) => (
              <div key={servico.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-5 ${!servico.ativo ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{servico.nome}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => openModal(servico)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteClick(servico)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {servico.descricao && <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mb-3">{servico.descricao}</p>}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                    <Clock size={16} />
                    {formatDuration(servico.duracao)}
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                    <DollarSign size={16} />
                    {formatCurrency(servico.preco)}
                  </div>
                </div>
                {servico.categoria && (
                  <span className="inline-block mt-3 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                    {servico.categoria}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingServico ? 'Editar Serviço' : 'Novo Serviço'}</h2>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Duração (minutos) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.duracao}
                    onChange={(e) => setFormData({ ...formData, duracao: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Preço *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco}
                    onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categoria</label>
                <input
                  type="text"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Cabelo, Unhas, Estética"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="ativo" className="text-sm text-gray-700 dark:text-gray-200">Serviço ativo</label>
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
                Tem certeza que deseja excluir o serviço <strong>{deleteModal.servico?.nome}</strong>?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ open: false, servico: null })}
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
