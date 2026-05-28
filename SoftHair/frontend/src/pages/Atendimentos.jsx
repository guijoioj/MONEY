import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { atendimentosAPI, clientesAPI, produtosAPI, servicosAPI, profissionaisAPI, fechamentosAPI } from '../services/api';
import { Plus, X, Clock, Package, Scissors, Trash2, Eye, Edit2, Save, Calculator, User, AlertCircle, UserPlus, DollarSign } from 'lucide-react';
import ClienteSearchSelect from '../components/ClienteSearchSelect';

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

// Extrai "HH:mm" de ISO timestamp ("2024-01-15T09:30:00Z") ou "09:30:00" ou "09:30"
const toTime = (v) => {
  if (!v) return '';
  const s = String(v);
  if (s.includes('T')) return s.slice(11, 16);
  if (s.length >= 5) return s.slice(0, 5);
  return '';
};

// Extrai "YYYY-MM-DD" de ISO timestamp ou date string
const toDateStr = (v) => {
  if (!v) return '';
  const s = String(v);
  if (s.includes('T')) return s.slice(0, 10);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
};

// Extrai array de resposta paginada { data: [...], total: N } ou array direto
const toArr = (val) => Array.isArray(val) ? val : (val?.data && Array.isArray(val.data) ? val.data : []);

// Data de HOJE em local (YYYY-MM-DD). NÃO usar toISOString (dá data UTC, que à
// noite no BRT já virou o dia seguinte).
const hojeLocal = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function Atendimentos() {
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewAtendimento, setViewAtendimento] = useState(null);
  const [editingAtendimento, setEditingAtendimento] = useState(null);
  const [filtroData, setFiltroData] = useState(hojeLocal());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    clienteId: '',
    profissionalId: '',
    auxiliarId: '',
    data: hojeLocal(),
    horaInicio: '',
    horaFim: '',
    desconto: 0,
    observacoes: ''
  });
  
  const [produtosUsados, setProdutosUsados] = useState([]);
  const [servicosUsados, setServicosUsados] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [buscaServico, setBuscaServico] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  // Vindo do hub Fechamentos (?new=1): ao fechar o modal, volta pro hub.
  const [veioDoHub, setVeioDoHub] = useState(false);
  const navigate = useNavigate();

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
    queryFn: () => produtosAPI.getAll({ ativo: true, limit: 2000 }),
  });

  const { data: servicosData } = useQuery({
    queryKey: ['servicos-dropdown'],
    queryFn: () => servicosAPI.getAll({ ativo: true, limit: 2000 }),
  });

  const { data: profissionaisData } = useQuery({
    queryKey: ['profissionais-dropdown'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const queryClient = useQueryClient();

  // Persiste serviços e produtos via endpoints dedicados (backend deriva preço/comissão).
  // Itens marcados _persisted (já no banco) são pulados pra não duplicar em edição.
  const persistItens = async (atendimentoId, servicos = [], produtos = []) => {
    for (const s of servicos) {
      if (s._persisted) continue;
      await atendimentosAPI.adicionarServico(atendimentoId, { servico_id: s.servicoId, quantidade: 1 });
    }
    for (const p of produtos) {
      if (p._persisted) continue;
      // Produto não bloqueia o atendimento se falhar (insumo, não receita).
      try {
        await atendimentosAPI.adicionarProduto(atendimentoId, {
          produto_id: p.produtoId,
          quantidade_usada: p.quantidadeUsada,
          unidade: p.unidade,
          preco_unitario: p.precoUnitario,
          subtotal: p.subtotal,
        });
      } catch (e) {
        console.warn('Produto não persistido:', e?.response?.data || e?.message);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await atendimentosAPI.create({
        cliente_id: payload.clienteId,
        profissional_id: payload.profissionalId,
        status: 'em_andamento',
        observacoes: payload.observacoes || null,
        data_atendimento: payload.data || null,
        hora_inicio: payload.horaInicio || null,
        hora_fim: payload.horaFim || null,
        desconto: payload.desconto || 0,
      });
      const id = res?.data?.data?.id;
      if (!id) throw new Error('Falha ao criar atendimento (sem id)');
      await persistItens(id, payload.servicos, payload.produtos);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['atendimentos']);
      queryClient.invalidateQueries(['fechamentos-em-aberto']);
      closeModal();
    },
    onError: (err) => {
      console.error('Erro ao criar atendimento:', err);
      alert(err.response?.data?.error || err.message || 'Erro ao salvar atendimento');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Atualiza data/hora/desconto/observação (backend usa COALESCE — null mantém atual).
      await atendimentosAPI.update(id, {
        observacoes: (data.observacoes ?? '').trim() || null,
        data_atendimento: data.data || null,
        hora_inicio: data.horaInicio || null,
        hora_fim: data.horaFim || null,
        desconto: data.desconto || 0,
      });
      await persistItens(id, data.servicos, data.produtos);
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['atendimentos']);
      queryClient.invalidateQueries(['fechamentos-em-aberto']);
      closeModal();
    },
    onError: (err) => {
      console.error('Erro ao atualizar atendimento:', err);
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

  const totalProdutos = produtosUsados.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const totalServicos = servicosUsados.reduce((sum, item) => sum + (Number(item.preco) || 0), 0);
  const subtotal = totalProdutos + totalServicos;
  const desconto = parseFloat(formData.desconto) || 0;
  const totalGeral = Math.max(0, subtotal - desconto);

  // Verifica parâmetros na URL: edit (conversão de agendamento) ou new (vindo do hub Fechamentos)
  useEffect(() => {
    const editId = searchParams.get('edit');
    const isNew = searchParams.get('new') === '1';
    if (editId) {
      loadAtendimentoForEdit(editId);
      window.history.replaceState({}, '', '/atendimentos');
    } else if (isNew) {
      setVeioDoHub(true);
      openModal();
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
        data: hojeLocal(),
        horaInicio: '',
        horaFim: '',
        desconto: 0,
        observacoes: ''
      });
      setProdutosUsados([]);
      setServicosUsados([]);
      setClienteSelecionado(null);
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
      // Cliente selecionado para exibir no campo de busca
      const cliId = atendimento.cliente_id ?? atendimento.clienteId ?? null;
      const cliNome = atendimento.cliente_nome ?? atendimento.clienteNome ?? null;
      setClienteSelecionado(cliId ? { id: cliId, nome: cliNome || `Cliente #${cliId}`, telefone: atendimento.cliente_telefone ?? atendimento.clienteTelefone ?? '' } : null);
      // Backend retorna snake_case (cliente_id, profissional_id, data_atendimento).
      // Suporta ambos para compatibilidade com local (SoftHair/backend) e Render (SOFT-HAIR-SERVER).
      setFormData({
        clienteId: atendimento.clienteId ?? atendimento.cliente_id ?? '',
        profissionalId: atendimento.profissionalId ?? atendimento.profissional_id ?? '',
        auxiliarId: atendimento.auxiliarId ?? atendimento.auxiliar_id ?? '',
        data: toDateStr(atendimento.dataAtendimento ?? atendimento.data_atendimento ?? atendimento.data) || hojeLocal(),
        horaInicio: toTime(atendimento.horaInicio ?? atendimento.hora_inicio),
        horaFim: toTime(atendimento.horaFim ?? atendimento.hora_fim),
        desconto: atendimento.desconto || 0,
        observacoes: atendimento.observacoes || ''
      });

      // Carrega serviços e produtos já persistidos (endpoints dedicados).
      // _persisted=true → handleSubmit não reenvia (evita duplicar).
      try {
        const [svcRes, prodRes] = await Promise.all([
          atendimentosAPI.listarServicos(id).catch(() => null),
          atendimentosAPI.listarProdutos(id).catch(() => null),
        ]);
        // Resposta vem camelCase (middleware camelize): nomeSnapshot, valorSnapshot,
        // precoUnitario, quantidadeUsada. Mantém fallback snake por segurança.
        setServicosUsados(toArr(svcRes?.data?.data).map(s => ({
          _persisted: true,
          servicoId: s.servicoId ?? s.servico_id,
          servicoNome: s.nomeSnapshot ?? s.nome_snapshot ?? '',
          horaInicio: '',
          horaFim: '',
          preco: Number(s.subtotal ?? s.valorSnapshot ?? s.valor_snapshot ?? 0),
          duracao: 0,
        })));
        setProdutosUsados(toArr(prodRes?.data?.data).map(p => ({
          _persisted: true,
          produtoId: p.produtoId ?? p.produto_id,
          produtoNome: p.nomeSnapshot ?? p.nome_snapshot ?? '',
          quantidadeUsada: Number(p.quantidadeUsada ?? p.quantidade_usada ?? 0),
          unidade: p.unidade || 'un',
          precoUnitario: Number(p.precoUnitario ?? p.preco_unitario ?? 0),
          subtotal: Number(p.subtotal ?? 0),
        })));
      } catch {
        setServicosUsados([]);
        setProdutosUsados([]);
      }

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
    setClienteSelecionado(null);
    setBuscaProduto('');
    setBuscaServico('');
    if (veioDoHub) {
      setVeioDoHub(false);
      navigate('/fechamento'); // volta pro hub Atendimentos & Fechamentos
    }
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
    const precoUnit = Number(produto.preco_venda ?? produto.precoVenda ?? 0);
    const newItem = {
      produtoId: produto.id,
      produtoNome: produto.nome,
      quantidadeUsada: 0.025,
      unidade: 'L',
      fracao: '25ml',
      precoUnitario: precoUnit,
      subtotal: precoUnit * 0.025
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
    const duracao = Number(servico.duracaoMinutos ?? servico.duracao_minutos ?? servico.duracao ?? 0);
    const horaFimCalculada = calcularHoraFim(horaAtual, duracao);

    const newItem = {
      servicoId: servico.id,
      servicoNome: servico.nome,
      horaInicio: horaAtual,
      horaFim: horaFimCalculada,
      preco: Number(servico.preco ?? 0),
      duracao
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
    const dur = Number(duracaoMinutos);
    if (!horaInicio || !horaInicio.includes(':') || Number.isNaN(dur)) return horaInicio || '';
    const [hours, minutes] = horaInicio.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return horaInicio;
    const totalMinutes = hours * 60 + minutes + dur;
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

    if (!formData.clienteId) { alert('Selecione um cliente'); return; }
    if (!formData.profissionalId) { alert('Selecione um profissional'); return; }
    if (servicosUsados.length === 0 && produtosUsados.length === 0) {
      alert('Adicione ao menos um serviço ou produto');
      return;
    }

    const payload = {
      clienteId: formData.clienteId,
      profissionalId: formData.profissionalId,
      observacoes: formData.observacoes,
      data: formData.data,
      horaInicio: formData.horaInicio,
      horaFim: formData.horaFim,
      desconto: parseFloat(formData.desconto) || 0,
      servicos: servicosUsados,
      produtos: produtosUsados,
    };

    if (editingAtendimento && editingAtendimento.id) {
      updateMutation.mutate({ id: editingAtendimento.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ id });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const s = String(dateStr);
    // DATE vem como meia-noite-UTC ("2026-05-28T00:00:00Z"); pegar Y-M-D direto
    // evita o shift de -1 dia que toLocaleDateString causa em BRT.
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Atendimentos</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={20} />
          Novo Atendimento
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Data</label>
            <input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Produtos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Serviços</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {atendimentos?.data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Nenhum atendimento encontrado
                  </td>
                </tr>
              ) : (
                (Array.isArray(atendimentos?.data?.data) ? atendimentos.data.data : []).map((atendimento) => (
                  <tr key={atendimento.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 text-gray-800 dark:text-gray-100">
                      {formatDate(atendimento.dataAtendimento ?? atendimento.data)}
                      {toTime(atendimento.horaInicio) ? <span className="block text-xs text-gray-500 dark:text-gray-400">{toTime(atendimento.horaInicio)}</span> : null}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{atendimento.profissionalNome || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{atendimento.clienteNome || 'Sem cliente'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(atendimento.totalProdutos)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(atendimento.totalServicos)}</td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(atendimento.totalGeral)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => viewDetails(atendimento)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded" title="Ver detalhes">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => loadAtendimentoForEdit(atendimento.id)} className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:bg-green-900/30 rounded" title="Editar">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(atendimento.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded" title="Excluir">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="text-indigo-600 dark:text-indigo-400" />
                {editingAtendimento ? 'Editar Atendimento' : 'Novo Atendimento'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Profissional</label>
                  <select
                    value={formData.profissionalId}
                    onChange={(e) => setFormData({ ...formData, profissionalId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione</option>
                    {toArr(profissionaisData?.data?.data).map((profissional) => (
                      <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1">
                    <UserPlus size={14} />
                    Auxiliar
                  </label>
                  <select
                    value={formData.auxiliarId}
                    onChange={(e) => setFormData({ ...formData, auxiliarId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Nenhum</option>
                    {toArr(profissionaisData?.data?.data)
                      .filter(p => {
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cliente</label>
                  <ClienteSearchSelect
                    value={formData.clienteId}
                    selectedCliente={clienteSelecionado}
                    onChange={(id, cliente) => {
                      setFormData({ ...formData, clienteId: id });
                      setClienteSelecionado(cliente || null);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
                  <input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Hora Início</label>
                  <input
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Hora Fim</label>
                  <input
                    type="time"
                    value={formData.horaFim}
                    onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Produtos */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <Package size={18} />
                  Produtos Utilizados
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="col-span-3">
                    <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">Selecionar Produto</label>
                    <input
                      type="text"
                      value={buscaProduto}
                      onChange={(e) => setBuscaProduto(e.target.value)}
                      placeholder="Buscar produto pelo nome..."
                      className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    {buscaProduto.trim() && (
                      <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                        {toArr(produtosData?.data?.data)
                          .filter(p => p.ativo !== false && (p.nome || '').toLowerCase().includes(buscaProduto.toLowerCase()))
                          .slice(0, 30)
                          .map((produto) => {
                            const estoque = produto.quantidadeEstoque ?? produto.quantidade_estoque ?? produto.estoque ?? 0;
                            const precoVenda = Number(produto.precoVenda ?? produto.preco_venda ?? 0);
                            return (
                              <button
                                key={produto.id}
                                type="button"
                                onClick={() => { addProduto(produto); setBuscaProduto(''); }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 rounded text-sm border-b last:border-b-0"
                              >
                                {produto.nome} - Estoque: {estoque} {produto.unidade || 'un'} - {formatCurrency(precoVenda)}/un
                              </button>
                            );
                          })}
                        {toArr(produtosData?.data?.data).filter(p => p.ativo !== false && (p.nome || '').toLowerCase().includes(buscaProduto.toLowerCase())).length === 0 && (
                          <p className="text-center py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum produto encontrado</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {produtosUsados.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-600 dark:text-gray-300">
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
                        <div className="col-span-2 font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(item.subtotal)}</div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => removeProduto(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-400 dark:text-gray-500 border rounded-lg">Nenhum produto adicionado</p>
                )}
              </div>

              {/* Serviços */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <Scissors size={18} />
                  Serviços Realizados
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="col-span-3">
                    <label className="block text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">Selecionar Serviço</label>
                    <input
                      type="text"
                      value={buscaServico}
                      onChange={(e) => setBuscaServico(e.target.value)}
                      placeholder="Buscar serviço pelo nome..."
                      className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    {buscaServico.trim() && (
                      <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                        {toArr(servicosData?.data?.data)
                          .filter(s => s.ativo !== false && (s.nome || '').toLowerCase().includes(buscaServico.toLowerCase()))
                          .slice(0, 30)
                          .map((servico) => (
                            <button
                              key={servico.id}
                              type="button"
                              onClick={() => { addServico(servico); setBuscaServico(''); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 rounded text-sm border-b last:border-b-0"
                            >
                              {servico.nome} - {formatCurrency(Number(servico.preco ?? 0))} - {servico.duracaoMinutos ?? servico.duracao_minutos ?? servico.duracao ?? 0}min
                            </button>
                          ))}
                        {toArr(servicosData?.data?.data).filter(s => s.ativo !== false && (s.nome || '').toLowerCase().includes(buscaServico.toLowerCase())).length === 0 && (
                          <p className="text-center py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum serviço encontrado</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {servicosUsados.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-600 dark:text-gray-300">
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
                        <div className="col-span-2 font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(item.preco)}</div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => removeServico(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-400 dark:text-gray-500 border rounded-lg">Nenhum serviço adicionado</p>
                )}
              </div>

              {/* Totais */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Total Produtos:</span>
                      <span className="font-medium">{formatCurrency(totalProdutos)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Total Serviços:</span>
                      <span className="font-medium">{formatCurrency(totalServicos)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Desconto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.desconto}
                        onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold border-t pt-3 mt-3">
                      <span>Total Geral:</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(totalGeral)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Observações sobre o atendimento..."
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
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
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Detalhes do Atendimento</h2>
              <button onClick={() => setViewAtendimento(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Profissional</p>
                  <p className="font-medium flex items-center gap-2">
                    <User size={16} className="text-gray-400 dark:text-gray-500" />
                    {viewAtendimento.profissionalNome || 'Não definido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Cliente</p>
                  <p className="font-medium">{viewAtendimento.clienteNome || 'Sem cliente'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Data</p>
                  <p className="font-medium">{formatDate(viewAtendimento.data)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Horário</p>
                  <p className="font-medium">{formatTime(viewAtendimento.horaInicio)} - {formatTime(viewAtendimento.horaFim)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Desconto</p>
                  <p className="font-medium">{formatCurrency(viewAtendimento.desconto)}</p>
                </div>
              </div>

              {viewAtendimento.produtos?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Produtos Utilizados</h3>
                  <div className="border rounded-lg divide-y">
                    {viewAtendimento.produtos.map((p, i) => (
                      <div key={i} className="p-3 flex justify-between">
                        <div>
                          <p className="font-medium">{p.produtoNome}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{p.quantidadeUsada} {p.unidade}</p>
                        </div>
                        <p className="font-medium">{formatCurrency(p.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Total: {formatCurrency(viewAtendimento.totalProdutos)}
                  </div>
                </div>
              )}

              {viewAtendimento.servicos?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Serviços Realizados</h3>
                  <div className="border rounded-lg divide-y">
                    {viewAtendimento.servicos.map((s, i) => (
                      <div key={i} className="p-3 flex justify-between">
                        <div>
                          <p className="font-medium">{s.servicoNome}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{s.horaInicio} - {s.horaFim} ({s.duracao}min)</p>
                        </div>
                        <p className="font-medium">{formatCurrency(s.preco)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Total: {formatCurrency(viewAtendimento.totalServicos)}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
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
                  <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(viewAtendimento.totalGeral)}</span>
                </div>
              </div>

              {viewAtendimento.observacoes && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Observações</p>
                  <p className="text-gray-700 dark:text-gray-200">{viewAtendimento.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">Confirmar Exclusão</h2>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
                Tem certeza que deseja excluir este atendimento?<br/>
                <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium"
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
