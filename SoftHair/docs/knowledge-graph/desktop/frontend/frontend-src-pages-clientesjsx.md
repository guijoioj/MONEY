# frontend/src/pages/Clientes.jsx

**Repository:** Desktop
**File:** `frontend/src/pages/Clientes.jsx`
**Language:** `jsx`

---

#desktop #source

## Resumo

Arquivo `frontend/src/pages/Clientes.jsx` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientesAPI, historicoAPI, vendasAPI, fechamentosAPI, creditosAPI } from '../services/api';
import { Search, Plus, Edit2, Trash2, X, Phone, Mail, Calendar, AlertCircle, User, Clock, Package, Scissors, DollarSign, Star, TrendingUp, ShoppingCart, ShoppingBag, RotateCcw, Gift } from 'lucide-react';

export default function Clientes() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, cliente: null });
  const [profileModal, setProfileModal] = useState({ open: false, cliente: null });
  const [comprasModal, setComprasModal] = useState({ open: false, cliente: null });
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', cpf: '', dataNascimento: '', endereco: '', observacoes: '' });

  const { data: historicoData, isLoading: loadingHistorico, refetch: refetchHistorico } = useQuery({
    queryKey: ['historico-cliente', profileModal.cliente?.id],
    queryFn: async () => {
      if (!profileModal.cliente?.id) return null;
      try {
        const res = await historicoAPI.getResumo(profileModal.cliente.id);
        console.log('Historico API response:', res.data);
        return res.data.data;
      } catch (err) {
        console.error('Erro ao buscar historico:', err);
        return null;
      }
    },
    enabled: !!profileModal.cliente?.id,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => clientesAPI.getAll({ search }),
  });

  const { data: vendasClienteData, refetch: refetchVendas } = useQuery({
    queryKey: ['vendas-cliente', comprasModal.cliente?.id],
    queryFn: () => {
      if (!comprasModal.cliente?.id) return [];
      return vendasAPI.getByCliente(comprasModal.cliente.id);
    },
    enabled: !!comprasModal.cliente?.id,
  });

  // Buscar fechamentos do cliente para o histórico
  const { data: fechamentosClienteData, refetch: refetchFechamentos } = useQuery({
    queryKey: ['fechamentos-cliente', profileModal.cliente?.id],
    queryFn: () => {
      if (!profileModal.cliente?.id) return [];
      return fechamentosAPI.getAll({ clienteId: profileModal.cliente.id });
    },
    enabled: !!profileModal.cliente?.id,
  });

  // Buscar saldo de crédito da cliente (fidelidade)
  const { data: creditoData, refetch: refetchCredito } = useQuery({
    queryKey: ['credito-saldo', profileModal.cliente?.id],
    queryFn: () => {
      if (!profileModal.cliente?.id) return 0;
      return creditosAPI.getSaldo(profileModal.cliente.id);
    },
    enabled: !!profileModal.cliente?.id,
  });

  const [estornoModal, setEstornoModal] = useState({ open: false, fechamento: null });
  const [estornoMotivo, setEstornoMotivo] = useState('');

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

  const estornoMutation = useMutation({
    mutationFn: async ({ id, motivo }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/fechamentos/${id}/estornar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ motivo })
      });
      if (!response.ok) throw new Error('Erro ao estornar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['historico-cliente']);
      queryClient.invalidateQueries(['fechamentos-cliente']);
      setEstornoModal({ open: false, fechamento: null });
      setEstornoMotivo('');
    },
    onError: (err) => {
      alert('Erro ao estornar fechamento');
    },
  });

  const openModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData(cliente);
    } else {
      setEditingCliente(null);
      setFormData({ nome: '', email: '', telefone: '', cpf: '', dataNascimento: '', endereco: '', observacoes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCliente(null);
    setFormData({ nome: '', email: '', telefone: '', cpf: '', dataNascimento: '', endereco: '', observacoes: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (cliente) => {
    setDeleteModal({ open: true, cliente });
  };

  const confirmDelete = () => {
    if (deleteModal.cliente) {
      deleteMutation.mutate(deleteModal.cliente.id);
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                data?.data?.data?.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{cliente.nome}</td>
                    <td className="px-6 py-4 text-gray-600">{cliente.telefone}</td>
                    <td className="px-6 py-4 text-gray-600">{cliente.email || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openProfile(cliente)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded" title="Ver perfil">
                          <User size={18} />
                        </button>
                        <button onClick={() => setComprasModal({ open: true, cliente })} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Histórico de Compras">
                          <ShoppingBag size={18} />
                        </button>
                        <button onClick={() => openModal(cliente)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteClick(cliente)} className="p-2 text-red-600 hover:bg-red-50 rounded">
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
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                <input
                  type="text"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={formData.dataNascimento}
                    onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
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
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                <AlertCircle className="text-red-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Confirmar Exclusão</h2>
              <p className="text-gray-600 text-center mb-6">
                Tem certeza que deseja excluir o cliente <strong>{deleteModal.cliente?.nome}</strong>?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ open: false, cliente: null })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
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

      {profileModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="text-indigo-600" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{profileModal.cliente?.nome}</h2>
                  <p className="text-gray-500 text-sm">{profileModal.cliente?.telefone}</p>
                </div>
              </div>
              <button onClick={() => setProfileModal({ open: false, cliente: null })} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistorico ? (
                <div className="text-center py-8 text-gray-500">Carregando histórico...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-pink-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-pink-600 mb-1">
                        <Scissors size={16} />
                        <span className="text-sm font-medium">Atendimentos</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{historicoData?.resumo?.totalAtendimentos || 0}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <ShoppingCart size={16} />
                        <span className="text-sm font-medium">Compras</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{historicoData?.resumo?.totalVendas || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <DollarSign size={16} />
                        <span className="text-sm font-medium">Gasto em Serviços</span>
                      </div>
                      <p className="text-lg font-bold text-gray-800">{formatCurrency(historicoData?.resumo?.totalGastoServicos)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-orange-600 mb-1">
                        <Package size={16} />
                        <span className="text-sm font-medium">Gasto em Produtos</span>
                      </div>
                      <p className="text-lg font-bold text-gray-800">{formatCurrency(historicoData?.resumo?.totalGastoProdutos)}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-600 mb-1">
                        <Gift size={16} />
                        <span className="text-sm font-medium">Crédito</span>
                      </div>
                      <p className="text-lg font-bold text-gray-800">{formatCurrency(creditoData?.data?.data?.saldo || 0)}</p>
                      <p className="text-xs text-yellow-600">5% acima de R$100</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Star className="text-yellow-500" size={18} />
                        Serviços Mais Frequentes
                      </h3>
                      {historicoData?.resumo?.servicosFavoritos?.length > 0 ? (
                        <div className="space-y-2">
                          {historicoData.resumo.servicosFavoritos.map((serv, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-800">{serv.nome}</p>
                                <p className="text-xs text-gray-500">{serv.categoria || '-'}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-indigo-600">{serv.count}x</p>
                                <p className="text-xs text-gray-500">{formatCurrency(serv.totalGasto || 0)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">Nenhum serviço registrado</p>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Package className="text-purple-500" size={18} />
                        Produtos Mais Comprados
                      </h3>
                      {historicoData?.resumo?.produtosFavoritos?.length > 0 ? (
                        <div className="space-y-2">
                          {historicoData.resumo.produtosFavoritos.map((prod, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-800">{prod.nome}</p>
                                <p className="text-xs text-gray-500">{prod.categoria || '-'}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-purple-600">{prod.quantidade}x</p>
                                <p className="text-xs text-gray-500">{formatCurrency(prod.totalGasto || 0)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">Nenhuma compra registrada</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <TrendingUp className="text-green-500" size={18} />
                      Profissionais Preferidos
                    </h3>
                    {historicoData?.resumo?.profissionaisFavoritos?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {historicoData.resumo.profissionaisFavoritos.map((prof, idx) => (
                          <span key={idx} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                            {prof.nome} ({prof.count}x)
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Nenhum profissional registrado</p>
                    )}
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Clock className="text-blue-500" size={18} />
                      Últimos Fechamentos
                    </h3>
                    {historicoData?.resumo?.atendimentos?.length > 0 ? (
                      <div className="space-y-2">
                        {historicoData.resumo.atendimentos.slice(0, 10).map((fech) => (
                          <div key={fech.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{formatDate(fech.data)}</p>
                              <p className="text-xs text-gray-500">
                                {fech.profissionalNome || 'Profissional não informado'} | 
                                Serviços: {formatCurrency(fech.totalAtendimentos)} | Produtos: {formatCurrency(fech.totalVendas)}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-green-600">{formatCurrency(fech.totalGeral)}</p>
                              <button
                                onClick={() => setEstornoModal({ open: true, fechamento: fech })}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                title="Estornar"
                              >
                                <RotateCcw size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Nenhum fechamento registrado</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {comprasModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <ShoppingBag className="text-green-600" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Histórico de Compras</h2>
                  <p className="text-gray-500 text-sm">{comprasModal.cliente?.nome}</p>
                </div>
              </div>
              <button onClick={() => setComprasModal({ open: false, cliente: null })} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {!vendasClienteData?.data?.data || vendasClienteData.data.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhuma compra registrada para este cliente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {vendasClienteData.data.data.map((venda) => (
                    <div key={venda.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-gray-800">Venda #{venda.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-500">{formatDate(venda.data)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(venda.total)}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                            venda.status === 'fechado' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {venda.status === 'fechado' ? 'Fechado' : 'Aberto'}
                          </span>
                        </div>
                      </div>
                      
                      {venda.itens && venda.itens.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-600 mb-2">Produtos:</p>
                          <div className="space-y-1">
                            {venda.itens.filter(i => i.tipo === 'produto').map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {item.produtoNome || item.itemNome || 'Produto'}
                                </span>
                                <span className="text-gray-600">
                                  {item.quantidade}x {formatCurrency(item.precoUnitario)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div className="bg-green-50 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-800">Total Gasto em Produtos:</span>
                      <span className="font-bold text-green-600 text-lg">
                        {formatCurrency(vendasClienteData.data.data.reduce((sum, v) => sum + (v.total || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {estornoModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Estornar Fechamento</h3>
              <button onClick={() => setEstornoModal({ open: false, fechamento: null })} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-medium">Atenção! Esta ação não pode ser desfeita.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Data</p>
                  <p className="font-medium">{formatDate(estornoModal.fechamento?.data)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="font-bold text-red-600">{formatCurrency(estornoModal.fechamento?.totalGeral)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Estorno *</label>
                <textarea
                  value={estornoMotivo}
                  onChange={(e) => setEstornoMotivo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Informe o motivo do estorno..."
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setEstornoModal({ open: false, fechamento: null })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!estornoMotivo.trim()) {
                    alert('Informe o motivo do estorno');
                    return;
                  }
                  estornoMutation.mutate({ 
                    id: estornoModal.fechamento.id, 
                    motivo: estornoMotivo 
                  });
                }}
                disabled={estornoMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {estornoMutation.isPending ? 'Estornando...' : 'Confirmar Estorno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```
