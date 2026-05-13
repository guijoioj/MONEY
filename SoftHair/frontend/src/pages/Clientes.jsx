// v2
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientesAPI, vendasAPI, fechamentosAPI } from '../services/api';
import { Search, Plus, Edit2, Trash2, X, Phone, Mail, Calendar, AlertCircle, User, Clock, Package, Scissors, DollarSign, Star, TrendingUp, ShoppingCart, ShoppingBag, Gift } from 'lucide-react';

export default function Clientes() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, cliente: null });
  const [profileModal, setProfileModal] = useState({ open: false, cliente: null });
  const [comprasModal, setComprasModal] = useState({ open: false, cliente: null });
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', cpf: '', dataNascimento: '', observacoes: '' });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openModal();
      setSearchParams({});
    }
  }, []);

  const { data: queryData, isLoading, isFetching } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => clientesAPI.getAll({ search: search || undefined, limit: 500 }),
  });

  // Extrair lista independente do formato da resposta
  const raw = queryData?.data?.data;
  const allClientes = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  const total = raw?.total ?? allClientes.length;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    if (e.target.value === '') setSearch('');
  };

  const { data: vendasClienteData } = useQuery({
    queryKey: ['vendas-cliente', comprasModal.cliente?.id],
    queryFn: () => {
      if (!comprasModal.cliente?.id) return [];
      return vendasAPI.getByCliente(comprasModal.cliente.id);
    },
    enabled: !!comprasModal.cliente?.id,
  });

  const { data: fechamentosClienteData } = useQuery({
    queryKey: ['fechamentos-cliente', profileModal.cliente?.id],
    queryFn: () => {
      if (!profileModal.cliente?.id) return [];
      return fechamentosAPI.getAll({ clienteId: profileModal.cliente.id });
    },
    enabled: !!profileModal.cliente?.id,
  });

  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => clientesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      closeModal();
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.message || 'Erro ao criar cliente');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => clientesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      closeModal();
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.message || 'Erro ao atualizar cliente');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => clientesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      setDeleteModal({ open: false, cliente: null });
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.message || 'Erro ao excluir cliente');
    },
  });

  const openModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome || '',
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        cpf: cliente.cpf || '',
        dataNascimento: cliente.dataNascimento || cliente.data_nascimento || '',
        observacoes: cliente.observacoes || '',
      });
    } else {
      setEditingCliente(null);
      setFormData({ nome: '', email: '', telefone: '', cpf: '', dataNascimento: '', observacoes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCliente(null);
    setFormData({ nome: '', email: '', telefone: '', cpf: '', dataNascimento: '', observacoes: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openProfile = (cliente) => {
    setProfileModal({ open: true, cliente });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const fechamentos = fechamentosClienteData?.data?.data || [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Clientes</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchInput}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            Buscar
          </button>
        </form>
        {total > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Mostrando {allClientes.length} de {total} clientes
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {allClientes.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                allClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-100">{cliente.nome}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{cliente.telefone}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{cliente.email || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openProfile(cliente)} className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/30 rounded" title="Ver perfil">
                          <User size={18} />
                        </button>
                        <button onClick={() => setComprasModal({ open: true, cliente })} className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:bg-green-900/30 rounded" title="Histórico de Compras">
                          <ShoppingBag size={18} />
                        </button>
                        <button onClick={() => openModal(cliente)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => setDeleteModal({ open: true, cliente })} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded">
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
        {total > allClientes.length && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
            Mostrando {allClientes.length} de {total}. Use a busca para filtrar.
          </p>
        )}
        </>
      )}

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</h2>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Telefone *</label>
                <input
                  type="text"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={formData.dataNascimento}
                    onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
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

      {/* Modal Confirmação Exclusão */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">Confirmar Exclusão</h2>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
                Tem certeza que deseja excluir o cliente <strong>{deleteModal.cliente?.nome}</strong>?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ open: false, cliente: null })}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteModal.cliente.id)}
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

      {/* Modal Perfil */}
      {profileModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="text-indigo-600 dark:text-indigo-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{profileModal.cliente?.nome}</h2>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">{profileModal.cliente?.telefone}</p>
                </div>
              </div>
              <button onClick={() => setProfileModal({ open: false, cliente: null })} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
                    <Gift size={16} />
                    <span className="text-sm font-medium">Crédito</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{formatCurrency(profileModal.cliente?.credito || 0)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Clock size={16} />
                    <span className="text-sm font-medium">Fechamentos</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{fechamentos.length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                    <DollarSign size={16} />
                    <span className="text-sm font-medium">Total Gasto</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {formatCurrency(fechamentos.reduce((sum, f) => sum + (f.totalGeral || f.total || 0), 0))}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Clock className="text-blue-500" size={18} />
                  Últimos Fechamentos
                </h3>
                {fechamentos.length > 0 ? (
                  <div className="space-y-2">
                    {fechamentos.slice(0, 10).map((fech) => (
                      <div key={fech.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-100">{formatDate(fech.data)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            {fech.profissionalNome || 'Profissional não informado'}
                          </p>
                        </div>
                        <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(fech.totalGeral || fech.total || 0)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum fechamento registrado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Compras */}
      {comprasModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <ShoppingBag className="text-green-600 dark:text-green-400" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Histórico de Compras</h2>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">{comprasModal.cliente?.nome}</p>
                </div>
              </div>
              <button onClick={() => setComprasModal({ open: false, cliente: null })} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const vraw = vendasClienteData?.data?.data;
                const vendas = Array.isArray(vraw) ? vraw : (Array.isArray(vraw?.data) ? vraw.data : []);
                return !vendas.length ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhuma compra registrada para este cliente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {vendas.map((venda) => (
                    <div key={venda.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-100">Venda #{venda.id?.slice(0, 8) || venda.id}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(venda.data)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(venda.total)}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                            venda.status === 'fechado' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {venda.status === 'fechado' ? 'Fechado' : 'Aberto'}
                          </span>
                        </div>
                      </div>

                      {venda.itens && venda.itens.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Produtos:</p>
                          <div className="space-y-1">
                            {venda.itens.filter(i => i.tipo === 'produto').map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-200">{item.produtoNome || item.itemNome || 'Produto'}</span>
                                <span className="text-gray-600 dark:text-gray-300">{item.quantidade}x {formatCurrency(item.precoUnitario)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Total Gasto em Produtos:</span>
                      <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                        {formatCurrency(vendas.reduce((sum, v) => sum + (v.total || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              );})()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
