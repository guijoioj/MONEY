import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { atendimentosAPI, clientesAPI, produtosAPI, servicosAPI, profissionaisAPI } from '../services/api';
import { Plus, X, Clock, Package, Scissors, Trash2, Eye, Edit2, Save, Calculator, User, AlertCircle, UserPlus } from 'lucide-react';

const FRACOES = [
  { label: '25ml', value: 0.025 },
  { label: '50ml', value: 0.05 },
  { label: '75ml', value: 0.075 },
  { label: '100ml', value: 0.1 },
  { label: '150ml', value: 0.15 },
  { label: '200ml', value: 0.2 },
  { label: '250ml', value: 0.25 },
  { label: '500ml', value: 0.5 },
  { label: '1L', value: 1 },
];

export default function Atendimentos() {
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewAtendimento, setViewAtendimento] = useState(null);
  const [editingAtendimento, setEditingAtendimento] = useState(null);
  const [filtroData, setFiltroData] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    clienteId: '',
    profissionalId: '',
    auxiliarId: '',
    data: new Date().toISOString().split('T')[0],
    horaInicio: '',
    horaFim: '',
    desconto: 0,
    observacoes: ''
  });
  
  const [produtosUsados, setProdutosUsados] = useState([]);
  const [servicosUsados, setServicosUsados] = useState([]);

  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ['atendimentos', filtroData],
    queryFn: () => atendimentosAPI.getAll({ data: filtroData || undefined }),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientes-dropdown'],
    queryFn: () => clientesAPI.getAll({ limit: 1000 }),
  });

  const { data: produtosData } = useQuery({
    queryKey: ['produtos-dropdown'],
    queryFn: () => produtosAPI.getAll({ ativo: true }),
  });

  const { data: servicosData } = useQuery({
    queryKey: ['servicos-dropdown'],
    queryFn: () => servicosAPI.getAll({ ativo: true }),
  });

  const { data: profissionaisData } = useQuery({
    queryKey: ['profissionais-dropdown'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => atendimentosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['atendimentos']);
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      console.log('Update mutation - id:', id);
      console.log('Update mutation - data:', data);
      return atendimentosAPI.update(id, data);
    },
    onSuccess: (result) => {
      console.log('Update mutation - success:', result);
      console.log('Update mutation - status:', result?.status);
      console.log('Update mutation - data:', result?.data);
      queryClient.invalidateQueries(['atendimentos']);
      // Adicionar pequeno delay para garantir que os dados sejam processados
      setTimeout(() => {
        closeModal();
      }, 100);
    },
    onError: (err) => {
      console.error('Update mutation - error:', err);
      alert(err.response?.data?.error || err.message || 'Erro ao salvar atendimento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => atendimentosAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['atendimentos']);
      queryClient.invalidateQueries(['agendamentos']);
      queryClient.invalidateQueries(['fechamentos-em-aberto']);
      setDeleteConfirm(null);
    },
    onError: (err) => {
      console.error('Erro ao deletar atendimento:', err.response?.data || err);
      alert(err.response?.data?.error || 'Erro ao excluir atendimento');
    },
  });

  const totalProdutos = produtosUsados.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const totalServicos = servicosUsados.reduce((sum, item) => sum + (item.preco || 0), 0);
  const subtotal = totalProdutos + totalServicos;
  const desconto = parseFloat(formData.desconto) || 0;
  const totalGeral = Math.max(0, subtotal - desconto);

  // Verifica se há parâmetro edit na URL (vindo da conversão de agendamento)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      loadAtendimentoForEdit(editId);
      // Limpa o parâmetro da URL após abrir
      window.history.replaceState({}, '', '/atendimentos');
    }
  }, [searchParams]);

  const openModal = (atendimento = null) => {
    if (atendimento) {
      loadAtendimentoForEdit(atendimento.id);
    } else {
      setEditingAtendimento(null);
      setFormData({
        clienteId: '',
        profissionalId: '',
        auxiliarId: '',
        data: new Date().toISOString().split('T')[0],
        horaInicio: '',
        horaFim: '',
        desconto: 0,
        observacoes: ''
      });
      setProdutosUsados([]);
      setServicosUsados([]);
      setIsModalOpen(true);
    }
  };

  const loadAtendimentoForEdit = async (id) => {
    try {
      const res = await atendimentosAPI.getById(id);
      const atendimento = res.data.data;

      console.log('loadAtendimentoForEdit - atendimento:', atendimento);
      console.log('loadAtendimentoForEdit - atendimento.id:', atendimento?.id);

      setEditingAtendimento(atendimento);
      setFormData({
        clienteId: atendimento.clienteId || '',
        profissionalId: atendimento.profissionalId || '',
        auxiliarId: atendimento.auxiliarId || '',
        data: atendimento.data,
        horaInicio: atendimento.horaInicio || '',
        horaFim: atendimento.horaFim || '',
        desconto: atendimento.desconto || 0,
        observacoes: atendimento.observacoes || ''
      });

      setProdutosUsados(atendimento.produtos?.map(p => ({
        produtoId: p.produtoId,
        produtoNome: p.produtoNome,
        quantidadeUsada: p.quantidadeUsada,
        unidade: p.unidade,
        precoUnitario: p.precoUnitario,
        subtotal: p.subtotal
      })) || []);

      setServicosUsados(atendimento.servicos?.map(s => ({
        servicoId: s.servicoId,
        servicoNome: s.servicoNome,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        preco: s.preco,
        duracao: s.duracao
      })) || []);

      // IMPORTANTE: Abrir o modal após carregar todos os dados
      setIsModalOpen(true);
    } catch (err) {
      console.error('Erro ao carregar atendimento:', err);
      alert(err.response?.data?.error || 'Erro ao carregar atendimento');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAtendimento(null);
    setProdutosUsados([]);
    setServicosUsados([]);
  };

  const viewDetails = async (atendimento) => {
    try {
      const res = await atendimentosAPI.getById(atendimento.id);
      setViewAtendimento(res.data.data);
    } catch (err) {
      console.error('Erro ao carregar atendimento:', err);
    }
  };

  const addProduto = (produto) => {
    const newItem = {
      produtoId: produto.id,
      produtoNome: produto.nome,
      quantidadeUsada: 0.025,
      unidade: 'L',
      fracao: '25ml',
      precoUnitario: produto.precoVenda,
      subtotal: produto.precoVenda * 0.025
    };
    setProdutosUsados([...produtosUsados, newItem]);
  };

  const updateProdutoFracao = (index, fracaoValue, fracaoLabel) => {
    const newProdutos = [...produtosUsados];
    newProdutos[index].quantidadeUsada = fracaoValue;
    newProdutos[index].fracao = fracaoLabel;
    newProdutos[index].subtotal = fracaoValue * newProdutos[index].precoUnitario;
    setProdutosUsados(newProdutos);
  };

  const removeProduto = (index) => {
    setProdutosUsados(produtosUsados.filter((_, i) => i !== index));
  };

  const addServico = (servico) => {
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const horaFimCalculada = calcularHoraFim(horaAtual, servico.duracao);
    
    const newItem = {
      servicoId: servico.id,
      servicoNome: servico.nome,
      horaInicio: horaAtual,
      horaFim: horaFimCalculada,
      preco: servico.preco,
      duracao: servico.duracao
    };
    setServicosUsados([...servicosUsados, newItem]);
  };

  const updateServicoTime = (index, campo, valor) => {
    const newServicos = [...servicosUsados];
    newServicos[index][campo] = valor;
    
    if (campo === 'horaFim' && newServicos[index].horaInicio) {
      newServicos[index].duracao = calcularDuracao(newServicos[index].horaInicio, valor);
    }
    
    setServicosUsados(newServicos);
  };

  const removeServico = (index) => {
    setServicosUsados(servicosUsados.filter((_, i) => i !== index));
  };

  const calcularHoraFim = (horaInicio, duracaoMinutos) => {
    const [hours, minutes] = horaInicio.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duracaoMinutos;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const calcularDuracao = (horaInicio, horaFim) => {
    if (!horaInicio || !horaFim) return 0;
    const [h1, m1] = horaInicio.split(':').map(Number);
    const [h2, m2] = horaFim.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Debug: verificar dados antes de enviar
    console.log('Submit - editingAtendimento:', editingAtendimento);
    console.log('Submit - editingAtendimento.id:', editingAtendimento?.id);
    console.log('Submit - formData:', formData);
    console.log('Submit - produtosUsados:', produtosUsados);
    console.log('Submit - servicosUsados:', servicosUsados);

    // Validação básica
    if (!formData.data) {
      alert('Data é obrigatória');
      return;
    }

    // Validação adicional para edição
    if (editingAtendimento && !editingAtendimento.id) {
      alert('ID do atendimento não encontrado');
      return;
    }

    const descontoNum = parseFloat(formData.desconto) || 0;

    const data = {
      clienteId: formData.clienteId || null,
      profissionalId: formData.profissionalId || null,
      auxiliarId: formData.auxiliarId || null,
      data: formData.data,
      horaInicio: formData.horaInicio || null,
      horaFim: formData.horaFim || null,
      desconto: descontoNum,
      observacoes: formData.observacoes || null,
      totalProdutos,
      totalServicos,
      totalGeral,
      produtos: produtosUsados.map(p => ({
        produtoId: p.produtoId,
        quantidadeUsada: p.quantidadeUsada,
        unidade: p.unidade,
        precoUnitario: p.precoUnitario,
        subtotal: p.subtotal
      })),
      servicos: servicosUsados.map(s => ({
        servicoId: s.servicoId,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        preco: s.preco,
        duracao: s.duracao
      }))
    };

    console.log('Submit - data to send:', data);

    if (editingAtendimento && editingAtendimento.id) {
      console.log('Updating atendimento:', editingAtendimento.id);
      updateMutation.mutate({ id: editingAtendimento.id, data });
    } else {
      console.log('Creating new atendimento');
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ id });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Atendimentos</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Atendimento
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Data</label>
            <input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profissional</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produtos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serviços</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {atendimentos?.data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    Nenhum atendimento encontrado
                  </td>
                </tr>
              ) : (
                atendimentos?.data?.data?.map((atendimento) => (
                  <tr key={atendimento.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-800">{formatDate(atendimento.data)}</td>
                    <td className="px-6 py-4 text-gray-600">{atendimento.profissionalNome || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{atendimento.clienteNome || 'Sem cliente'}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(atendimento.totalProdutos)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(atendimento.totalServicos)}</td>
                    <td className="px-6 py-4 font-medium text-indigo-600">{formatCurrency(atendimento.totalGeral)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => viewDetails(atendimento)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Ver detalhes">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => loadAtendimentoForEdit(atendimento.id)} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Editar">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(atendimento.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Excluir">
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

      {/* Modal Novo/Editar Atendimento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="text-indigo-600" />
                {editingAtendimento ? 'Editar Atendimento' : 'Novo Atendimento'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
                  <select
                    value={formData.profissionalId}
                    onChange={(e) => setFormData({ ...formData, profissionalId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione</option>
                    {profissionaisData?.data?.data?.map((profissional) => (
                      <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <UserPlus size={14} />
                    Auxiliar
                  </label>
                  <select
                    value={formData.auxiliarId}
                    onChange={(e) => setFormData({ ...formData, auxiliarId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Nenhum</option>
                    {profissionaisData?.data?.data
                      ?.filter(p => {
                        if (p.id === formData.profissionalId) return false;
                        const especialidade = (p.especialidade || '').toLowerCase();
                        return especialidade.includes('auxiliar') || especialidade.includes('assistente');
                      })
                      .map((profissional) => (
                        <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <select
                    value={formData.clienteId}
                    onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione um cliente</option>
                    {clientesData?.data?.data?.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Início</label>
                  <input
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fim</label>
                  <input
                    type="time"
                    value={formData.horaFim}
                    onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Produtos */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Package size={18} />
                  Produtos Utilizados
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-500 mb-2">Selecionar Produto</label>
                    <div className="max-h-32 overflow-y-auto border rounded-lg p-2">
                      {produtosData?.data?.data?.filter(p => p.ativo && p.estoque > 0).map((produto) => (
                        <button
                          key={produto.id}
                          type="button"
                          onClick={() => addProduto(produto)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm border-b last:border-b-0"
                        >
                          {produto.nome} - Estoque: {produto.estoque} {produto.unidade || 'un'} - {formatCurrency(produto.precoVenda)}/un
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {produtosUsados.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 text-sm font-medium text-gray-600">
                      <div className="col-span-4">Produto</div>
                      <div className="col-span-3">Quantidade</div>
                      <div className="col-span-2">Valor Unit.</div>
                      <div className="col-span-2">Subtotal</div>
                      <div className="col-span-1"></div>
                    </div>
                    {produtosUsados.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 p-3 items-center">
                        <div className="col-span-4 font-medium">{item.produtoNome}</div>
                        <div className="col-span-3">
                          <select
                            value={item.fracao}
                            onChange={(e) => {
                              const fracao = FRACOES.find(f => f.label === e.target.value);
                              if (fracao) updateProdutoFracao(index, fracao.value, fracao.label);
                            }}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            {FRACOES.map(f => (
                              <option key={f.label} value={f.label}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 text-sm">{formatCurrency(item.precoUnitario)}</div>
                        <div className="col-span-2 font-medium text-indigo-600">{formatCurrency(item.subtotal)}</div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => removeProduto(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-400 border rounded-lg">Nenhum produto adicionado</p>
                )}
              </div>

              {/* Serviços */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Scissors size={18} />
                  Serviços Realizados
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-500 mb-2">Selecionar Serviço</label>
                    <div className="max-h-32 overflow-y-auto border rounded-lg p-2">
                      {servicosData?.data?.data?.filter(s => s.ativo).map((servico) => (
                        <button
                          key={servico.id}
                          type="button"
                          onClick={() => addServico(servico)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm border-b last:border-b-0"
                        >
                          {servico.nome} - {formatCurrency(servico.preco)} - {servico.duracao}min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {servicosUsados.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 text-sm font-medium text-gray-600">
                      <div className="col-span-3">Serviço</div>
                      <div className="col-span-2">Início</div>
                      <div className="col-span-2">Fim</div>
                      <div className="col-span-2">Duração</div>
                      <div className="col-span-2">Valor</div>
                      <div className="col-span-1"></div>
                    </div>
                    {servicosUsados.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 p-3 items-center">
                        <div className="col-span-3 font-medium">{item.servicoNome}</div>
                        <div className="col-span-2">
                          <input
                            type="time"
                            value={item.horaInicio}
                            onChange={(e) => updateServicoTime(index, 'horaInicio', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="time"
                            value={item.horaFim}
                            onChange={(e) => updateServicoTime(index, 'horaFim', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div className="col-span-2 text-sm">{item.duracao}min</div>
                        <div className="col-span-2 font-medium text-indigo-600">{formatCurrency(item.preco)}</div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => removeServico(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-400 border rounded-lg">Nenhum serviço adicionado</p>
                )}
              </div>

              {/* Totais */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Total Produtos:</span>
                      <span className="font-medium">{formatCurrency(totalProdutos)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Total Serviços:</span>
                      <span className="font-medium">{formatCurrency(totalServicos)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.desconto}
                        onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold border-t pt-3 mt-3">
                      <span>Total Geral:</span>
                      <span className="text-indigo-600">{formatCurrency(totalGeral)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Observações sobre o atendimento..."
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingAtendimento ? 'Salvar Alterações' : 'Salvar Atendimento')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalhes */}
      {viewAtendimento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Detalhes do Atendimento</h2>
              <button onClick={() => setViewAtendimento(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Profissional</p>
                  <p className="font-medium flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    {viewAtendimento.profissionalNome || 'Não definido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-medium">{viewAtendimento.clienteNome || 'Sem cliente'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Data</p>
                  <p className="font-medium">{formatDate(viewAtendimento.data)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Horário</p>
                  <p className="font-medium">{formatTime(viewAtendimento.horaInicio)} - {formatTime(viewAtendimento.horaFim)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Desconto</p>
                  <p className="font-medium">{formatCurrency(viewAtendimento.desconto)}</p>
                </div>
              </div>

              {viewAtendimento.produtos?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-700 mb-3">Produtos Utilizados</h3>
                  <div className="border rounded-lg divide-y">
                    {viewAtendimento.produtos.map((p, i) => (
                      <div key={i} className="p-3 flex justify-between">
                        <div>
                          <p className="font-medium">{p.produtoNome}</p>
                          <p className="text-sm text-gray-500">{p.quantidadeUsada} {p.unidade}</p>
                        </div>
                        <p className="font-medium">{formatCurrency(p.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm text-gray-600">
                    Total: {formatCurrency(viewAtendimento.totalProdutos)}
                  </div>
                </div>
              )}

              {viewAtendimento.servicos?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-700 mb-3">Serviços Realizados</h3>
                  <div className="border rounded-lg divide-y">
                    {viewAtendimento.servicos.map((s, i) => (
                      <div key={i} className="p-3 flex justify-between">
                        <div>
                          <p className="font-medium">{s.servicoNome}</p>
                          <p className="text-sm text-gray-500">{s.horaInicio} - {s.horaFim} ({s.duracao}min)</p>
                        </div>
                        <p className="font-medium">{formatCurrency(s.preco)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm text-gray-600">
                    Total: {formatCurrency(viewAtendimento.totalServicos)}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(viewAtendimento.totalProdutos + viewAtendimento.totalServicos)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(viewAtendimento.desconto)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span className="text-indigo-600">{formatCurrency(viewAtendimento.totalGeral)}</span>
                </div>
              </div>

              {viewAtendimento.observacoes && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500">Observações</p>
                  <p className="text-gray-700">{viewAtendimento.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                <AlertCircle className="text-red-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Confirmar Exclusão</h2>
              <p className="text-gray-600 text-center mb-6">
                Tem certeza que deseja excluir este atendimento?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    deleteMutation.mutate(deleteConfirm.id);
                  }}
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
