import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agendamentosAPI, clientesAPI, servicosAPI } from '../services/api';
import { Plus, Edit2, Trash2, X, Calendar as CalendarIcon, Clock, User } from 'lucide-react';

export default function Agendamentos() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState(null);
  const [formData, setFormData] = useState({ clienteId: '', servicoId: '', dataHora: '', observacoes: '' });
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);

  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ['agendamentos', filtroData],
    queryFn: () => agendamentosAPI.getAll({ data: filtroData }),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientes-dropdown'],
    queryFn: () => clientesAPI.getAll({ limit: 1000 }),
  });

  const { data: servicosData } = useQuery({
    queryKey: ['servicos-dropdown'],
    queryFn: () => servicosAPI.getAll({ ativo: true }),
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => agendamentosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos']);
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => agendamentosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos']);
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => agendamentosAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['agendamentos']),
  });

  const openModal = (agendamento = null) => {
    if (agendamento) {
      setEditingAgendamento(agendamento);
      setFormData({
        clienteId: agendamento.clienteId,
        servicoId: agendamento.servicoId,
        dataHora: agendamento.dataHora.slice(0, 16),
        observacoes: agendamento.observacoes || '',
      });
    } else {
      setEditingAgendamento(null);
      setFormData({ clienteId: '', servicoId: '', dataHora: '', observacoes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAgendamento(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingAgendamento) {
      updateMutation.mutate({ id: editingAgendamento.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    const colors = {
      agendado: 'bg-blue-100 text-blue-700',
      confirmado: 'bg-green-100 text-green-700',
      concluido: 'bg-gray-100 text-gray-700',
      cancelado: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Agendamentos</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Agendamento
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <CalendarIcon className="text-gray-400" size={20} />
          <input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {agendamentos?.data?.data?.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Nenhum agendamento para esta data
            </div>
          ) : (
            agendamentos?.data?.data?.map((agendamento) => (
              <div key={agendamento.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <User className="text-indigo-600" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{agendamento.clienteNome}</h3>
                        <p className="text-gray-500 text-sm">{agendamento.clienteTelefone}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock size={16} />
                        {formatTime(agendamento.dataHora)} - {agendamento.servicoNome}
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                        R$ {agendamento.servicoPreco?.toFixed(2)}
                      </span>
                    </div>
                    {agendamento.observacoes && (
                      <p className="mt-2 text-sm text-gray-500">{agendamento.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agendamento.status)}`}>
                      {agendamento.status}
                    </span>
                    <button onClick={() => openModal(agendamento)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(agendamento.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={formData.clienteId}
                  onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clientesData?.data?.data?.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>{cliente.nome} - {cliente.telefone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serviço *</label>
                <select
                  value={formData.servicoId}
                  onChange={(e) => setFormData({ ...formData, servicoId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {servicosData?.data?.data?.map((servico) => (
                    <option key={servico.id} value={servico.id}>{servico.nome} - R$ {servico.preco.toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora *</label>
                <input
                  type="datetime-local"
                  value={formData.dataHora}
                  onChange={(e) => setFormData({ ...formData, dataHora: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
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
    </div>
  );
}
