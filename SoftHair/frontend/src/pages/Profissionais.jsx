import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profissionaisAPI } from '../services/api';
import { useAdminPin } from '../context/AdminPinContext';
import { Search, Plus, Edit2, Trash2, X, User, Phone, Mail, MapPin, AlertCircle } from 'lucide-react';

export default function Profissionais() {
  const { requestPin } = useAdminPin();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfissional, setEditingProfissional] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, profissional: null });
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    especialidade: '',
    comissao_percentual: 0,
    ativo: true,
    senha_app: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['profissionais', search],
    queryFn: () => profissionaisAPI.getAll({ search: search || undefined, ativo: true }),
  });

  const queryClient = useQueryClient();

  const [formError, setFormError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => profissionaisAPI.create(data),
    onSuccess: () => { queryClient.invalidateQueries(['profissionais']); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.error || err.message || 'Erro ao criar profissional'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => profissionaisAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['profissionais']); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.error || err.message || 'Erro ao atualizar profissional'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => profissionaisAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['profissionais']); setDeleteModal({ open: false, profissional: null }); },
    onError: (err) => alert(err.response?.data?.error || 'Erro ao excluir profissional'),
  });

  const openModal = async (profissional = null) => {
    // Editar sempre pede PIN; criar não precisa de PIN
    if (profissional) {
      const ok = await requestPin();
      if (!ok) return;
    }
    if (profissional) {
      setEditingProfissional(profissional);
      setFormData({
        nome: profissional.nome || '',
        telefone: profissional.telefone || '',
        email: profissional.email || '',
        especialidade: profissional.especialidade || '',
        comissao_percentual: profissional.comissao_percentual || 0,
        ativo: profissional.ativo !== 0,
        senha_app: ''
      });
    } else {
      setEditingProfissional(null);
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        especialidade: '',
        comissao_percentual: 0,
        ativo: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfissional(null);
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProfissional) {
      updateMutation.mutate({ id: editingProfissional.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = async (profissional) => {
    const ok = await requestPin();
    if (!ok) return;
    setDeleteModal({ open: true, profissional });
  };

  const confirmDelete = () => {
    if (deleteModal.profissional) {
      deleteMutation.mutate(deleteModal.profissional.id);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Profissionais</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Profissional
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar profissionais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.data?.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Nenhum profissional encontrado
            </div>
          ) : (
            [...(data?.data?.data || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((profissional) => (
              <div key={profissional.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <User className="text-indigo-600 dark:text-indigo-400" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{profissional.nome}</h3>
                      {profissional.especialidade && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{profissional.especialidade}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openModal(profissional)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded" title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteClick(profissional)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded" title="Excluir">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  {profissional.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400 dark:text-gray-500" />
                      <span>{profissional.telefone}</span>
                    </div>
                  )}
                  {profissional.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400 dark:text-gray-500" />
                      <span className="truncate">{profissional.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <User className="text-indigo-600 dark:text-indigo-400" />
                {editingProfissional ? 'Editar Profissional' : 'Novo Profissional'}
              </h2>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Especialidade</label>
                <input
                  type="text"
                  value={formData.especialidade}
                  onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Cabeleireira, Esteticista..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Senha App Mobile</label>
                <input
                  type="password"
                  value={formData.senha_app}
                  onChange={(e) => setFormData({ ...formData, senha_app: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder={editingProfissional ? 'Deixe em branco para não alterar' : 'Senha para login no app'}
                  minLength={6}
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
                <label htmlFor="ativo" className="text-sm text-gray-700 dark:text-gray-200">Profissional ativo</label>
              </div>

              {formError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}
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
                Tem certeza que deseja excluir o profissional <strong>{deleteModal.profissional?.nome}</strong>?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ open: false, profissional: null })}
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
