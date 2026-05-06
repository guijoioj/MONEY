import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agendamentosAPI, clientesAPI, servicosAPI, profissionaisAPI, atendimentosAPI, bloqueiosAPI } from '../services/api';
import { 
  ChevronLeft, ChevronRight, Plus, X, Clock, User, Phone, 
  Scissors, Filter, Calendar as CalendarIcon, Check, RefreshCw, AlertCircle, Trash2
} from 'lucide-react';

const PROFISSIONAL_COLORS = [
  { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-800', accent: '#ec4899' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', accent: '#a855f7' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', accent: '#f43f5e' },
  { bg: 'bg-fuchsia-100', border: 'border-fuchsia-400', text: 'text-fuchsia-800', accent: '#d946ef' },
  { bg: 'bg-violet-100', border: 'border-violet-400', text: 'text-violet-800', accent: '#8b5cf6' },
  { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', accent: '#f472b6' },
  { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', accent: '#fb7185' },
  { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', accent: '#c084fc' },
];

const HORARIOS = [];
for (let h = 8; h <= 23; h++) {
  HORARIOS.push(`${String(h).padStart(2, '0')}:00`);
  HORARIOS.push(`${String(h).padStart(2, '0')}:15`);
  HORARIOS.push(`${String(h).padStart(2, '0')}:30`);
  HORARIOS.push(`${String(h).padStart(2, '0')}:45`);
}

const SLOT_HEIGHT = 28; // px por slot de 15 minutos

const ROLE_COLORS = {
  'Cabeleireiro': { bg: '#4F46E5', text: '#fff' },
  'Barbeiro': { bg: '#7C3AED', text: '#fff' },
  'Auxiliar': { bg: '#D97706', text: '#fff' },
  'Manicure': { bg: '#DB2777', text: '#fff' },
  'Esteticista': { bg: '#059669', text: '#fff' },
  'Depilador': { bg: '#DC2626', text: '#fff' },
  'Maquiador': { bg: '#0891B2', text: '#fff' },
};

// Normaliza o nome do cargo para agrupar masculino/feminino
const normalizeRole = (role) => {
  if (!role) return 'Outros';
  
  const lower = role.toLowerCase().trim();
  
  // Mapeamento de cargos que devem ser agrupados
  const mappings = [
    // Cabeleireiro(a)
    { patterns: [/cabeleireir[ao]/i, /cabelereir[ao]/i, /cabeleir[ao]/i], normalized: 'Cabeleireiro' },
    // Barbeiro(a)
    { patterns: [/barbeir[ao]/i], normalized: 'Barbeiro' },
    // Manicure/Pedicure
    { patterns: [/manicur[ae]/i, /pedicur[ae]/i, /esteticist[ae] nail/i], normalized: 'Manicure' },
    // Esteticista
    { patterns: [/esteticist[ae]/i, /estetic[ae]/i], normalized: 'Esteticista' },
    // Depilador(a)
    { patterns: [/depil[ae]/i], normalized: 'Depilador' },
    // Maquiador(a)
    { patterns: [/maqui[ae]/i], normalized: 'Maquiador' },
    // Auxiliar
    { patterns: [/auxiliar/i, /assistente/i], normalized: 'Auxiliar' },
  ];
  
  for (const mapping of mappings) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(lower)) {
        return mapping.normalized;
      }
    }
  }
  
  // Se não encontrou mapeamento, capitaliza a primeira letra
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

const getRoleColor = (role) => {
  const normalized = Object.keys(ROLE_COLORS).find(k =>
    role?.toLowerCase().includes(k.toLowerCase())
  );
  return ROLE_COLORS[normalized] || { bg: '#6B7280', text: '#fff' };
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getDiasDaSemana(dataBase) {
  const inicio = new Date(dataBase);
  const dia = inicio.getDay();
  inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function gerarHorariosAgenda(inicioStr = '08:00', fimStr = '20:00', intervalo = 30) {
  const horarios = [];
  let [h, m] = inicioStr.split(':').map(Number);
  const [fh, fm] = fimStr.split(':').map(Number);
  while (h < fh || (h === fh && m <= fm)) {
    horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += intervalo;
    if (m >= 60) { h++; m -= 60; }
  }
  return horarios;
}

const HORARIOS_SEMANA = gerarHorariosAgenda('08:00', '20:00', 30);

export default function Agenda() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfissionais, setSelectedProfissionais] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState(null);
  const [selectedProfissionalCelula, setSelectedProfissionalCelula] = useState(null);
  const [selectedHoraCelula, setSelectedHoraCelula] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  const [agendamentosConvertidos, setAgendamentosConvertidos] = useState([]);
  const [hoveredAgendamento, setHoveredAgendamento] = useState(null);
  const [viewMode, setViewMode] = useState('dia'); // 'dia' | 'semana'
  const [semanaBase, setSemanaBase] = useState(new Date());
  const [isBloqueioModalOpen, setIsBloqueioModalOpen] = useState(false);
  const [bloqueioForm, setBloqueioForm] = useState({
    profissionalId: '', dataInicio: '', dataFim: '', motivo: 'Bloqueado', diaInteiro: false,
  });
  const gridRef = useRef(null);
  const autoConvertRef = useRef(false);
  const allAgendamentosRef = useRef([]);
  
  const COL_WIDTH = 140;
  const TIME_COL_WIDTH = 80;

  const [formData, setFormData] = useState({
    clienteId: '',
    servicoId: '',
    profissionalId: '',
    auxiliarId: '',
    dataHora: '',
    observacoes: '',
    status: 'agendado'
  });

  const [aviso, setAviso] = useState({ tipo: '', mensagem: '' });

  const { data: agendamentosData, isLoading: loadingAgendamentos, refetch: refetchAgendamentos } = useQuery({
    queryKey: ['agendamentos-calendario'],
    queryFn: () => agendamentosAPI.getAll({}),
    refetchInterval: 30000,
  });

  const { data: pendentesData } = useQuery({
    queryKey: ['agendamentos-pendentes'],
    queryFn: () => agendamentosAPI.getPendentes(),
    refetchInterval: 60000,
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientes-dropdown'],
    queryFn: () => clientesAPI.getAll({ limit: 1000 }),
  });

  const { data: servicosData } = useQuery({
    queryKey: ['servicos-dropdown'],
    queryFn: () => servicosAPI.getAll({ ativo: true }),
  });

  const { data: profissionaisData } = useQuery({
    queryKey: ['profissionais-dropdown'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const { data: configData } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => import('../services/api').then(m => m.default.get('/configuracoes')),
    refetchInterval: 60000,
  });

  const { data: atendimentosData, refetch: refetchAtendimentos } = useQuery({
    queryKey: ['atendimentos-agenda', selectedDate.toISOString().split('T')[0]],
    queryFn: () => atendimentosAPI.getAll({ data: selectedDate.toISOString().split('T')[0], comServicos: true }),
    refetchInterval: 60000,
  });

  const { data: bloqueiosData, refetch: refetchBloqueios } = useQuery({
    queryKey: ['bloqueios', selectedDate.toISOString().split('T')[0]],
    queryFn: () => bloqueiosAPI.getByData(selectedDate.toISOString().split('T')[0]),
    refetchInterval: 60000,
  });

  const createBloqueioMutation = useMutation({
    mutationFn: (data) => bloqueiosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bloqueios']);
      setIsBloqueioModalOpen(false);
      setBloqueioForm({ profissionalId: '', dataInicio: '', dataFim: '', motivo: 'Bloqueado', diaInteiro: false });
    },
    onError: () => console.error('Erro ao criar bloqueio'),
  });

  const deleteBloqueioMutation = useMutation({
    mutationFn: (id) => bloqueiosAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['bloqueios']),
  });

  const createMutation = useMutation({
    mutationFn: (data) => agendamentosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
      closeModal();
    },
    onError: () => {
      console.error('Erro ao criar agendamento');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => agendamentosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
      closeModal();
    },
    onError: () => {
      console.error('Erro ao atualizar agendamento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => agendamentosAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
    },
    onError: () => {
      console.error('Erro ao deletar agendamento');
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      deleteMutation.mutate(id);
      setIsModalOpen(false);
      setEditingAgendamento(null);
    }
  };

  const moverAgendamentoMutation = useMutation({
    mutationFn: ({ id, data }) => agendamentosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
    },
    onError: () => console.error('Erro ao mover agendamento'),
  });

  const handleMoverAgendamento = (agendamentoId, novaHora) => {
    const agend = allAgendamentos.find(a => String(a.id) === String(agendamentoId));
    if (!agend || !agend.dataHora) return;
    const dataAtual = agend.dataHora.split('T')[0];
    const novaDataHora = `${dataAtual}T${novaHora}:00`;
    moverAgendamentoMutation.mutate({ id: agend.id, data: { ...agend, dataHora: novaDataHora } });
  };

  const converterMutation = useMutation({
    mutationFn: () => agendamentosAPI.converterTodos(),
    onSuccess: (res) => {
      if (res.data?.resultados?.length > 0) {
        setNotificacao({
          tipo: 'success',
          mensagem: `${res.data.resultados.length} atendimento(s) criado(s) automaticamente!`
        });
        setAgendamentosConvertidos(res.data.resultados.map(r => r.atendimento?.id));
      }
      setTimeout(() => {
        queryClient.removeQueries(['agendamentos-calendario']);
        queryClient.removeQueries(['agendamentos-pendentes']);
        queryClient.removeQueries(['atendimentos']);
        queryClient.removeQueries(['atendimentos-agenda']);
        queryClient.invalidateQueries(['agendamentos-calendario']);
        queryClient.invalidateQueries(['agendamentos-pendentes']);
        queryClient.invalidateQueries(['atendimentos']);
        queryClient.invalidateQueries(['atendimentos-agenda']);
      }, 100);
    },
    onError: () => {
      console.error('Erro ao converter agendamentos');
    },
  });

  const converterUmMutation = useMutation({
    mutationFn: ({ id, navigateAfter = false }) => agendamentosAPI.converter(id).then(res => ({ ...res, _navigateAfter: navigateAfter })),
    onSuccess: (res) => {
      setTimeout(() => {
        queryClient.removeQueries(['agendamentos-calendario']);
        queryClient.removeQueries(['agendamentos-pendentes']);
        queryClient.removeQueries(['atendimentos']);
        queryClient.removeQueries(['atendimentos-agenda']);
        queryClient.invalidateQueries(['agendamentos-calendario']);
        queryClient.invalidateQueries(['agendamentos-pendentes']);
        queryClient.invalidateQueries(['atendimentos']);
        queryClient.invalidateQueries(['atendimentos-agenda']);
      }, 100);

      if (res._navigateAfter) {
        const atendimentoId = res.data?.atendimento?.id;
        if (atendimentoId) {
          navigate(`/atendimentos?edit=${atendimentoId}`);
        }
      }
    },
    onError: () => {
      console.error('Erro ao converter um agendamento');
    },
  });

  useEffect(() => {
    if (notificacao) {
      const timer = setTimeout(() => setNotificacao(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notificacao]);

  const allAgendamentos = Array.isArray(agendamentosData?.data?.data) ? agendamentosData.data.data : [];

  // Mantém refs atualizados para uso no intervalo sem re-criar o efeito
  autoConvertRef.current = configData?.data?.conversao_automatica === 'true';
  allAgendamentosRef.current = allAgendamentos;

  useEffect(() => {
    const check = () => {
      if (!autoConvertRef.current) return;
      const now = new Date();
      const em5min = new Date(now.getTime() + 5 * 60 * 1000);
      allAgendamentosRef.current.forEach(a => {
        if (a.status !== 'agendado') return;
        const hora = new Date(a.dataHora);
        if (hora >= now && hora <= em5min) {
          converterUmMutation.mutate({ id: a.id, navigateAfter: false });
        }
      });
    };
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const profissionaisRaw = Array.isArray(profissionaisData?.data?.data) ? profissionaisData.data.data : [];
  const profissionais = profissionaisRaw.filter(p => p && p.ativo);
  const clientes = Array.isArray(clientesData?.data?.data) ? clientesData.data.data : [];
  const servicos = Array.isArray(servicosData?.data?.data) ? servicosData.data.data : [];
  const atendimentosDoDia = Array.isArray(atendimentosData?.data?.data) ? atendimentosData.data.data : [];
  const bloqueios = Array.isArray(bloqueiosData?.data?.data) ? bloqueiosData.data.data : [];
  const diasDaSemana = getDiasDaSemana(semanaBase);

  const filteredProfissionais = useMemo(() => {
    if (filtroTipo === 'todos' || selectedProfissionais.length === 0) {
      return profissionais;
    }
    return profissionais.filter(p => {
      if (filtroTipo === 'todos') return true;
      if (filtroTipo === 'assistente' && p.especialidade?.toLowerCase().includes('assistente')) return true;
      if (filtroTipo === 'profissional' && (!p.especialidade || !p.especialidade.toLowerCase().includes('assistente'))) return true;
      return false;
    });
  }, [profissionais, filtroTipo, selectedProfissionais]);

  const visibleProfissionais = selectedProfissionais.length > 0
    ? profissionais.filter(p => selectedProfissionais.includes(p.id))
    : filteredProfissionais;

  const groupedProfissionais = useMemo(() => {
    const groups = [];
    const seen = {};
    visibleProfissionais.forEach(p => {
      const rawRole = p.especialidade || 'Outros';
      const role = normalizeRole(rawRole);
      if (!seen[role]) {
        seen[role] = { role, profissionais: [] };
        groups.push(seen[role]);
      }
      seen[role].profissionais.push(p);
    });
    return groups;
  }, [visibleProfissionais]);

  const getAgendamentosDoDia = (date, profissionalId) => {
    const dateStr = date.toISOString().split('T')[0];
    return allAgendamentos.filter(a => {
      if (!a.dataHora) return false;
      const agendDate = a.dataHora.split('T')[0];
      if (agendDate !== dateStr) return false;
      if (profissionalId && a.profissionalId !== profissionalId) return false;
      if (a.status === 'convertido') return false;
      if (statusFilter !== 'todos' && a.status !== statusFilter) return false;
      return true;
    });
  };

  const getDuracaoSlots = (agendamento) => {
    const servico = servicos.find(s => s.id === agendamento.servicoId);
    const duracaoMin = servico?.duracao || agendamento.servicoDuracao || 30;
    return Math.ceil(duracaoMin / 15);
  };

  const getAgendamentosNaHora = (date, profissionalId, hora) => {
    return getAgendamentosDoDia(date, profissionalId).filter(a => {
      if (!a.dataHora) return false;
      const horaAgend = a.dataHora.split('T')[1]?.substring(0, 5);
      if (!horaAgend) return false;
      return horaAgend === hora;
    });
  };

  const getAtendimentosDoProfissional = (profissionalId) => {
    return atendimentosDoDia.filter(a => a.profissionalId === profissionalId);
  };

  const getAtendimentosDoAuxiliar = (auxiliarId) => {
    return atendimentosDoDia.filter(a => a.auxiliarId === auxiliarId);
  };

  const getDuracaoAtendimentoSlots = (atendimento) => {
    if (!atendimento) return 4;
    
    if (atendimento.servicoDuracao) {
      return Math.ceil(atendimento.servicoDuracao / 15);
    }
    
    const servicosAtendimento = Array.isArray(atendimento.servicos) ? atendimento.servicos : [];
    if (servicosAtendimento.length === 0) return 4;
    
    const totalMinutos = servicosAtendimento.reduce((sum, s) => sum + (s.duracao || 30), 0);
    return Math.ceil(totalMinutos / 15);
  };

  const getDuracaoAtendimentoById = (atendimentoId) => {
    const atend = atendimentosDoDia.find(a => a.id === atendimentoId);
    if (!atend) return 4;
    return getDuracaoAtendimentoSlots(atend);
  };

  const verificarConflito = (profissionalId, dataHora, servicoId, excludeId = null) => {
    const servico = servicos.find(s => s.id === servicoId);
    const duracaoMin = servico?.duracao || 30;
    
    const dataHoraDate = new Date(dataHora);
    const dataStr = dataHoraDate.toISOString().split('T')[0];
    const horaInicio = dataHoraDate.toTimeString().slice(0, 5);
    const horaMinutosInicio = dataHoraDate.getHours() * 60 + dataHoraDate.getMinutes();
    const horaMinutosFim = horaMinutosInicio + duracaoMin;

    return allAgendamentos.filter(a => {
      if (!a.dataHora) return false;
      if (a.profissionalId !== profissionalId) return false;
      if (excludeId && a.id === excludeId) return false;
      if (a.status === 'convertido' || a.status === 'cancelado') return false;

      const agendDataStr = a.dataHora.split('T')[0];
      if (agendDataStr !== dataStr) return false;

      const agendServico = servicos.find(s => s.id === a.servicoId);
      const agendDuracao = agendServico?.duracao || a.servicoDuracao || 30;
      
      const agendDate = new Date(a.dataHora);
      const agendMinutosInicio = agendDate.getHours() * 60 + agendDate.getMinutes();
      const agendMinutosFim = agendMinutosInicio + agendDuracao;

      return horaMinutosInicio < agendMinutosFim && horaMinutosFim > agendMinutosInicio;
    });
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    for (let i = 0; i < firstDay.getDay(); i++) {
      const prevDate = new Date(year, month, -i);
      days.unshift({ date: prevDate, isCurrentMonth: false });
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const getProfissionalColor = (profissionalId) => {
    const index = profissionais.findIndex(p => p.id === profissionalId);
    return PROFISSIONAL_COLORS[index % PROFISSIONAL_COLORS.length];
  };

  const getClienteNome = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente?.nome || 'Cliente';
  };

  const getServicoNome = (servicoId) => {
    const servico = servicos.find(s => s.id === servicoId);
    return servico?.nome || 'Serviço';
  };

  const getProfissionalNome = (profissionalId) => {
    const profissional = profissionais.find(p => p.id === profissionalId);
    return profissional?.nome || 'Profissional';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const openModal = (agendamento = null, date = null, hora = null, profissional = null) => {
    if (agendamento) {
      setEditingAgendamento(agendamento);
      setFormData({
        clienteId: agendamento.clienteId || '',
        servicoId: agendamento.servicoId || '',
        profissionalId: agendamento.profissionalId || '',
        auxiliarId: agendamento.auxiliarId || '',
        dataHora: agendamento.dataHora?.slice(0, 16) || '',
        observacoes: agendamento.observacoes || '',
        status: agendamento.status || 'agendado',
      });
    } else {
      setEditingAgendamento(null);
      const defaultDate = date || selectedDate;
      const defaultTime = hora ? `${hora}:00` : '09:00';
      const defaultProfissional = profissional?.id || selectedProfissionalCelula?.id || visibleProfissionais[0]?.id || '';
      
      if (hora && profissional) {
        setSelectedProfissionalCelula(profissional);
        setSelectedHoraCelula(hora);
      }
      
      setFormData({
        clienteId: '',
        servicoId: '',
        profissionalId: defaultProfissional,
        auxiliarId: '',
        dataHora: `${defaultDate.toISOString().split('T')[0]}T${defaultTime}`,
        observacoes: '',
        status: 'agendado'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAgendamento(null);
    setSelectedProfissionalCelula(null);
    setSelectedHoraCelula(null);
    setAviso({ tipo: '', mensagem: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.dataHora) {
      setAviso({ tipo: 'erro', mensagem: 'Selecione uma data e hora' });
      return;
    }

    if (!formData.profissionalId) {
      setAviso({ tipo: 'erro', mensagem: 'Selecione um profissional' });
      return;
    }

    if (!formData.clienteId) {
      setAviso({ tipo: 'erro', mensagem: 'Selecione um cliente' });
      return;
    }

    if (!formData.servicoId) {
      setAviso({ tipo: 'erro', mensagem: 'Selecione um serviço' });
      return;
    }

    const agora = new Date();
    const horarioSelecionado = new Date(formData.dataHora);
    
    if (horarioSelecionado <= agora) {
      setAviso({ tipo: 'erro', mensagem: 'Não é possível agendar em horário já passado' });
      return;
    }

    const conflitos = verificarConflito(
      formData.profissionalId,
      formData.dataHora,
      formData.servicoId,
      editingAgendamento?.id
    );

    if (conflitos.length > 0) {
      const clienteConflito = clientes.find(c => c.id === conflitos[0].clienteId);
      const profissionalConflito = profissionais.find(p => p.id === formData.profissionalId);
      const horarioConflito = new Date(conflitos[0].dataHora);
      setAviso({ 
        tipo: 'erro', 
        mensagem: `Bloqueado: ${profissionalConflito?.nome || 'Profissional'} já tem agendamento marcado para ${horarioConflito.toLocaleDateString('pt-BR')} às ${horarioConflito.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} com ${clienteConflito?.nome || 'outro cliente'}. Escolha outro horário.` 
      });
      console.log('Conflito detectado:', conflitos);
      return;
    }

    // Aviso se auxiliar tem conflito com outro profissional
    if (formData.auxiliarId) {
      const servico = servicos.find(s => s.id === formData.servicoId);
      const duracaoMin = servico?.duracao || 30;
      const dataHoraDate = new Date(formData.dataHora);
      const minInicio = dataHoraDate.getHours() * 60 + dataHoraDate.getMinutes();
      const minFim = minInicio + duracaoMin;
      const dataStr = dataHoraDate.toISOString().split('T')[0];

      const conflitoAuxiliarMesmoProf = allAgendamentos.find(a => {
        if (!a.dataHora || !a.auxiliarId) return false;
        if (a.auxiliarId !== formData.auxiliarId) return false;
        if (a.profissionalId !== formData.profissionalId) return false;
        if (editingAgendamento && a.id === editingAgendamento.id) return false;
        if (a.status === 'cancelado') return false;
        const aDate = a.dataHora.split('T')[0];
        if (aDate !== dataStr) return false;
        const aServico = servicos.find(s => s.id === a.servicoId);
        const aDuracao = aServico?.duracao || 30;
        const aInicio = new Date(a.dataHora);
        const aMin = aInicio.getHours() * 60 + aInicio.getMinutes();
        return minInicio < (aMin + aDuracao) && minFim > aMin;
      });

      if (conflitoAuxiliarMesmoProf) {
        setAviso({ tipo: 'erro', mensagem: `Este auxiliar já está alocado para este profissional neste horário.` });
        return;
      }

      const conflitoAuxiliarOutroProf = allAgendamentos.find(a => {
        if (!a.dataHora || !a.auxiliarId) return false;
        if (a.auxiliarId !== formData.auxiliarId) return false;
        if (editingAgendamento && a.id === editingAgendamento.id) return false;
        if (a.status === 'cancelado') return false;
        const aDate = a.dataHora.split('T')[0];
        if (aDate !== dataStr) return false;
        const aServico = servicos.find(s => s.id === a.servicoId);
        const aDuracao = aServico?.duracao || 30;
        const aInicio = new Date(a.dataHora);
        const aMin = aInicio.getHours() * 60 + aInicio.getMinutes();
        return minInicio < (aMin + aDuracao) && minFim > aMin;
      });

      if (conflitoAuxiliarOutroProf) {
        const profConflito = profissionais.find(p => p.id === conflitoAuxiliarOutroProf.profissionalId);
        const auxNome = profissionais.find(p => p.id === formData.auxiliarId)?.nome || 'Auxiliar';
        setAviso({ tipo: 'aviso', mensagem: `Atenção: ${auxNome} já está auxiliando ${profConflito?.nome || 'outro profissional'} neste horário. Prossiga com cuidado.` });
      } else {
        setAviso({ tipo: '', mensagem: '' });
      }
    } else {
      setAviso({ tipo: '', mensagem: '' });
    }

    if (editingAgendamento?.isAtendimento) {
      setAviso({ tipo: 'erro', mensagem: 'Atendimentos devem ser editados na aba de Atendimentos.' });
      return;
    }

    if (editingAgendamento) {
      updateMutation.mutate({ id: editingAgendamento.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const getCountAgendamentosNoDia = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return allAgendamentos.filter(a => a.dataHora?.startsWith(dateStr)).length;
  };

  return (
    <div className="space-y-4">
      {notificacao && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 max-w-md animate-pulse ${
          notificacao.tipo === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notificacao.tipo === 'success' ? (
            <Check size={20} className="text-green-600" />
          ) : (
            <AlertCircle size={20} className="text-red-600" />
          )}
          <span className="flex-1">{notificacao.mensagem}</span>
          <button onClick={() => setNotificacao(null)} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
      )}

      {pendentesData?.data?.data?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-600" size={20} />
            <span className="text-yellow-800 font-medium">
              {pendentesData.data.data.length} agendamento(s) aguardando conversão
            </span>
          </div>
          <button
            onClick={() => converterMutation.mutate()}
            disabled={converterMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={converterMutation.isPending ? 'animate-spin' : ''} />
            Converter Agora
          </button>
        </div>
      )}

      {agendamentosConvertidos.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 font-medium flex items-center gap-2">
            <Check size={18} />
            {agendamentosConvertidos.length} atendimento(s) criado(s) automaticamente dos agendamentos
          </p>
          <button 
            onClick={() => setAgendamentosConvertidos([])}
            className="text-sm text-green-600 hover:text-green-700 mt-1"
          >
            Ocultar mensagem
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Agenda</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Dia / Semana */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
            <button
              onClick={() => setViewMode('dia')}
              className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'dia' ? 'bg-white shadow text-indigo-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >Dia</button>
            <button
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'semana' ? 'bg-white shadow text-indigo-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >Semana</button>
          </div>
          <button
            onClick={() => {
              const dateStr = selectedDate.toISOString().split('T')[0];
              setBloqueioForm({ profissionalId: '', dataInicio: `${dateStr}T08:00`, dataFim: `${dateStr}T09:00`, motivo: 'Bloqueado', diaInteiro: false });
              setIsBloqueioModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            🔒 Bloquear Horário
          </button>
          <button
            onClick={() => openModal(null, selectedDate)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus size={18} />
            Novo Agendamento
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 hover:bg-pink-50 rounded-lg transition-colors">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <h3 className="font-semibold text-gray-800">
                {MESES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <button onClick={nextMonth} className="p-2 hover:bg-pink-50 rounded-lg transition-colors">
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-xs font-medium text-gray-500 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                const count = getCountAgendamentosNoDia(date);
                return (
                  <button
                    key={idx}
                    onClick={() => handleDateSelect(date)}
                    className={`
                      relative p-2 text-sm rounded-lg transition-all
                      ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-pink-50'}
                      ${isToday(date) ? 'bg-pink-100 text-pink-700 font-semibold' : ''}
                      ${isSelected(date) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                    `}
                  >
                    {date.getDate()}
                    {count > 0 && isCurrentMonth && (
                      <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected(date) || isToday(date) ? 'bg-white' : 'bg-indigo-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-gray-500" />
              <h3 className="font-semibold text-gray-800">Filtros</h3>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Tipo</label>
              <div className="space-y-1">
                {[
                  { value: 'todos', label: 'Todos' },
                  { value: 'profissional', label: 'Profissionais' },
                  { value: 'assistente', label: 'Assistentes' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filtroTipo"
                      value={opt.value}
                      checked={filtroTipo === opt.value}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Profissionais</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProfissionais.length === 0}
                    onChange={() => setSelectedProfissionais([])}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Todos</span>
                </label>
                {profissionais.map((p, idx) => {
                  const color = PROFISSIONAL_COLORS[idx % PROFISSIONAL_COLORS.length];
                  return (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProfissionais.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProfissionais([...selectedProfissionais, p.id]);
                          } else {
                            setSelectedProfissionais(selectedProfissionais.filter(id => id !== p.id));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`w-3 h-3 rounded-full ${color.bg}`} style={{ borderLeft: `3px solid ${color.accent}` }} />
                      <span className="text-sm text-gray-700">{p.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Status</label>
              <div className="space-y-1">
                {[
                  { value: 'todos', label: 'Todos', color: 'bg-gray-400' },
                  { value: 'agendado', label: 'Agendado', color: 'bg-blue-500' },
                  { value: 'confirmado', label: 'Confirmado', color: 'bg-green-500' },
                  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-400' },
                  { value: 'convertido', label: 'Convertido', color: 'bg-purple-500' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={statusFilter === opt.value}
                      onChange={() => setStatusFilter(opt.value)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={`w-3 h-3 rounded-full ${opt.color}`} />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'dia' && <div className="flex-1 bg-white rounded-xl shadow overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1" ref={gridRef}>
            <div style={{ minWidth: TIME_COL_WIDTH + (visibleProfissionais.length * COL_WIDTH), minHeight: '100%' }}>
              <div className="sticky top-0 z-30 bg-gray-50 border-b border-r">
                {/* Linha 1: Barras de cargo agrupadas */}
                <div className="flex">
                  <div className="w-20 flex-shrink-0 border-r border-b" style={{ minHeight: 28 }} />
                  {groupedProfissionais.map(({ role, profissionais: profs }) => {
                    const roleColor = getRoleColor(role);
                    return (
                      <div
                        key={role}
                        className="border-r border-b flex items-center justify-center text-xs font-bold tracking-wide"
                        style={{
                          width: profs.length * COL_WIDTH,
                          minWidth: profs.length * COL_WIDTH,
                          height: 28,
                          backgroundColor: roleColor.bg,
                          color: roleColor.text,
                        }}
                      >
                        {role.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                {/* Linha 2: Nomes individuais */}
                <div className="flex">
                  <div className="w-20 flex-shrink-0 p-2 text-center border-r">
                    <span className="text-xs font-semibold text-gray-600">Horário</span>
                  </div>
                  {visibleProfissionais.map((profissional, idx) => {
                    const color = PROFISSIONAL_COLORS[idx % PROFISSIONAL_COLORS.length];
                    return (
                      <div
                        key={profissional.id}
                        className="min-w-[140px] w-[140px] p-1.5 text-center border-r"
                      >
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center mb-0.5`}>
                            <User size={14} className={color.text} />
                          </div>
                          <span className="text-xs font-medium text-gray-800 leading-tight">{profissional.nome?.split(' ')[0]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div style={{ position: 'relative', height: HORARIOS.length * SLOT_HEIGHT }}>
                {HORARIOS.map((hora, horaIdx) => {
                  const isHour = hora.endsWith(':00');
                  const isHalfHour = hora.endsWith(':30');
                  return (
                    <div
                      key={hora}
                      className="flex border-r"
                      style={{
                        height: SLOT_HEIGHT,
                        borderBottom: isHour ? '1px solid #d1d5db' : isHalfHour ? '1px dashed #e5e7eb' : '1px dotted #f3f4f6',
                      }}
                    >
                      <div className="w-20 flex-shrink-0 border-r bg-gray-50 flex items-start justify-end pr-2 pt-0.5">
                        {isHour ? (
                          <span className="text-xs font-semibold text-gray-700">{hora}</span>
                        ) : isHalfHour ? (
                          <span className="text-[10px] text-gray-400">{hora}</span>
                        ) : (
                          <span className="text-[9px] text-gray-300">{hora}</span>
                        )}
                      </div>
                      {visibleProfissionais.map((profissional) => (
                        <div
                          key={profissional.id}
                          className={`min-w-[140px] w-[140px] border-r relative ${Math.floor(horaIdx / 4) % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                          onClick={() => openModal(null, selectedDate, hora, profissional)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('agendamentoId');
                            if (id) handleMoverAgendamento(id, hora);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
                
                {visibleProfissionais.map((profissional, profIdx) => {
                  const color = PROFISSIONAL_COLORS[profIdx % PROFISSIONAL_COLORS.length];
                  const agendamentosDoProf = getAgendamentosDoDia(selectedDate, profissional.id);
                  const atendimentosDoProf = getAtendimentosDoProfissional(profissional.id);
                  const atendimentosDoAuxiliar = getAtendimentosDoAuxiliar(profissional.id);

                  // Coletar horários de agendamentos convertidos para não duplicar com atendimentos
                  const convertedProfTimes = new Set();
                  agendamentosDoProf.forEach(a => {
                    if (a.status === 'convertido' && a.dataHora) {
                      const hora = a.dataHora.split('T')[1]?.substring(0, 5);
                      if (hora) convertedProfTimes.add(hora);
                    }
                  });

                  // Coletar horários de agendamentos convertidos com auxiliar neste profissional
                  const convertedAuxTimes = new Set();
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  allAgendamentos.forEach(a => {
                    if (a.status === 'convertido' && a.auxiliarId === profissional.id && a.dataHora && a.dataHora.startsWith(dateStr)) {
                      const hora = a.dataHora.split('T')[1]?.substring(0, 5);
                      if (hora) convertedAuxTimes.add(hora);
                    }
                  });

                  return (
                    <>
                      {agendamentosDoProf.map((agend) => {
                        if (!agend.dataHora) return null;
                        if (agend.status === 'convertido') return null;
                        const horaAgend = agend.dataHora.split('T')[1]?.substring(0, 5);
                        if (!horaAgend) return null;
                        const [hh, mm] = horaAgend.split(':').map(Number);
                        const snappedHora = `${String(hh).padStart(2,'0')}:${String(Math.floor(mm/15)*15).padStart(2,'0')}`;
                        const horaIdx = HORARIOS.indexOf(snappedHora);
                        if (horaIdx === -1) return null;
                        
                        const slots = getDuracaoSlots(agend);
                        const top = horaIdx * SLOT_HEIGHT;
                        const height = slots * SLOT_HEIGHT;
                        const left = TIME_COL_WIDTH + profIdx * COL_WIDTH;
                        const isCancelled = agend.status === 'cancelado';
                        const isConfirmed = agend.status === 'confirmado';
                        const isHovered = hoveredAgendamento === agend.id;

                        const statusStyle = isCancelled
                          ? { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700', opacity: 'opacity-70', label: null }
                          : isConfirmed
                          ? { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800', opacity: '', label: null }
                          : { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800', opacity: '', label: null };

                        const servicoCor = servicos.find(s => s.id === agend.servicoId)?.cor || agend.servico?.cor || '#6366f1';
                        const cardStyle = (!isCancelled && !isConfirmed)
                          ? { backgroundColor: servicoCor + '20', borderLeftColor: servicoCor }
                          : {};

                        return (
                          <div
                            key={agend.id}
                            className={`absolute ${statusStyle.bg} ${statusStyle.border} ${statusStyle.opacity} border-l-4 p-1.5 rounded-r-lg text-xs cursor-pointer transition-all overflow-hidden z-20 hover:brightness-95`}
                            style={{
                              top: `${top}px`,
                              left: `${left}px`,
                              width: `${COL_WIDTH}px`,
                              height: `${height}px`,
                              ...cardStyle,
                            }}
                            draggable={!agend.isAtendimento}
                            onDragStart={(e) => e.dataTransfer.setData('agendamentoId', String(agend.id))}
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(agend);
                            }}
                            onMouseEnter={() => setHoveredAgendamento(agend.id)}
                            onMouseLeave={() => setHoveredAgendamento(null)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className={`font-semibold ${statusStyle.text} truncate text-[11px]`}>
                                  {getClienteNome(agend.clienteId)}
                                </div>
                                <div className={`${statusStyle.text} opacity-75 truncate text-[10px]`}>
                                  {getServicoNome(agend.servicoId)}
                                </div>
                                {slots > 1 && (
                                  <div className={`${statusStyle.text} opacity-60 text-[9px] mt-0.5`}>
                                    {slots * 15}min
                                  </div>
                                )}
                              </div>
                              {isCancelled && isHovered && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Excluir este agendamento?')) {
                                      deleteMutation.mutate(agend.id);
                                    }
                                  }}
                                  className="ml-1 p-1 bg-red-100 hover:bg-red-200 rounded text-red-600 flex-shrink-0"
                                  title="Excluir agendamento"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            {isCancelled && !isHovered && (
                              <div className="text-[9px] text-red-500 font-medium mt-0.5">
                                Cancelado
                              </div>
                            )}
                            {statusStyle.label && (
                              <div className={`text-[9px] font-medium mt-0.5 ${statusStyle.label.color}`}>
                                {statusStyle.label.text}
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {/* Célula auxiliar para agendamentos que têm auxiliarId neste profissional */}
                    {allAgendamentos.filter(a => {
                      if (!a.auxiliarId || a.auxiliarId !== profissional.id) return false;
                      if (!a.dataHora) return false;
                      const dateStr = selectedDate.toISOString().split('T')[0];
                      if (a.status === 'cancelado') return false;
                      if (a.status === 'convertido') return false;
                      return a.dataHora.startsWith(dateStr);
                    }).map(agend => {
                      const horaAgend = agend.dataHora.split('T')[1]?.substring(0, 5);
                      if (!horaAgend) return null;
                      const [hh2, mm2] = horaAgend.split(':').map(Number);
                      const snappedHora2 = `${String(hh2).padStart(2,'0')}:${String(Math.floor(mm2/15)*15).padStart(2,'0')}`;
                      const horaIdx = HORARIOS.indexOf(snappedHora2);
                      if (horaIdx === -1) return null;
                      const slots = getDuracaoSlots(agend);
                      const top = horaIdx * SLOT_HEIGHT;
                      const height = slots * SLOT_HEIGHT;
                      const left = TIME_COL_WIDTH + profIdx * COL_WIDTH;
                      return (
                        <div
                          key={`aux-agend-${agend.id}`}
                          className="absolute bg-teal-100 border-teal-500 border-l-4 p-1.5 rounded-r-lg text-xs cursor-pointer transition-all overflow-hidden z-20 hover:brightness-95"
                          style={{ top: `${top}px`, left: `${left}px`, width: `${COL_WIDTH}px`, height: `${height}px` }}
                          onClick={(e) => { e.stopPropagation(); openModal(agend); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-teal-800 truncate text-[11px]">
                              Auxiliar: {getProfissionalNome(agend.auxiliarId)}
                            </div>
                            <div className="text-teal-800 opacity-75 truncate text-[10px]">
                              {getClienteNome(agend.clienteId)}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {atendimentosDoProf.map((atend) => {
                      if (!atend.horaInicio) return null;
                      const horaIdx = HORARIOS.indexOf(atend.horaInicio);
                      if (horaIdx === -1) return null;
                      
                      const slots = getDuracaoAtendimentoSlots(atend);
                      const top = horaIdx * SLOT_HEIGHT;
                      const height = slots * SLOT_HEIGHT;
                      const left = TIME_COL_WIDTH + profIdx * COL_WIDTH;
                      
                      const agendamentoOriginal = allAgendamentos.find(a => a.atendimentoId === atend.id);
                      
                      return (
                        <div
                          key={`atend-${atend.id}`}
                          className="absolute bg-purple-100 border-purple-500 border-l-4 p-1.5 rounded-r-lg text-xs cursor-pointer transition-all overflow-hidden z-20 hover:brightness-95"
                          style={{
                            top: `${top}px`,
                            left: `${left}px`,
                            width: `${COL_WIDTH}px`,
                            height: `${height}px`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (agendamentoOriginal) {
                              openModal(agendamentoOriginal);
                            } else {
                              setFormData({
                                clienteId: atend.clienteId || '',
                                servicoId: '',
                                profissionalId: atend.profissionalId || '',
                                auxiliarId: atend.auxiliarId || '',
                                dataHora: `${atend.data}T${atend.horaInicio}`,
                                observacoes: atend.observacoes || '',
                                status: 'agendado'
                              });
                              setEditingAgendamento({ ...atend, isAtendimento: true });
                              setIsModalOpen(true);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-purple-800 truncate text-[11px]">
                                {atend.clienteNome || 'Cliente'}
                              </div>
                              <div className="text-purple-800 opacity-75 truncate text-[10px]">
                                {atend.servicos?.length || 0} serviço(s)
                              </div>
                              {atend.auxiliarId && (
                                <div className="text-purple-600 opacity-60 truncate text-[9px]">
                                  + Auxiliar
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {atendimentosDoAuxiliar.map((atend) => {
                      if (atend.profissionalId === profissional.id) return null;
                      if (!atend.horaInicio) return null;
                      const horaIdx = HORARIOS.indexOf(atend.horaInicio);
                      if (horaIdx === -1) return null;

                      const slots = getDuracaoAtendimentoSlots(atend);
                      const slotsMin = slots < 2 ? 2 : slots;

                      const top = horaIdx * SLOT_HEIGHT;
                      const height = slotsMin * SLOT_HEIGHT;
                      const left = TIME_COL_WIDTH + profIdx * COL_WIDTH;
                      
                      const agendamentoOriginal = allAgendamentos.find(a => a.atendimentoId === atend.id);
                      
                      return (
                        <div
                          key={`atend-aux-${atend.id}`}
                          className="absolute bg-teal-100 border-teal-500 border-l-4 p-1.5 rounded-r-lg text-xs cursor-pointer transition-all overflow-hidden z-20 hover:brightness-95"
                          style={{
                            top: `${top}px`,
                            left: `${left}px`,
                            width: `${COL_WIDTH}px`,
                            height: `${height}px`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (agendamentoOriginal) {
                              openModal(agendamentoOriginal);
                            } else {
                              setFormData({
                                clienteId: atend.clienteId || '',
                                servicoId: '',
                                profissionalId: atend.profissionalId || '',
                                auxiliarId: atend.auxiliarId || '',
                                dataHora: `${atend.data}T${atend.horaInicio}`,
                                observacoes: atend.observacoes || '',
                                status: 'agendado'
                              });
                              setEditingAgendamento({ ...atend, isAtendimento: true });
                              setIsModalOpen(true);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-teal-800 truncate text-[11px]">
                                Auxiliar: {getProfissionalNome(atend.auxiliarId)}
                              </div>
                              <div className="text-teal-800 opacity-75 truncate text-[10px]">
                                {atend.clienteNome || 'Cliente'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Bloqueios de horário */}
                    {bloqueios
                      .filter(b => !b.profissionalId || b.profissionalId === profissional.id)
                      .map((bloqueio) => {
                        const inicio = new Date(bloqueio.dataInicio);
                        const fim = new Date(bloqueio.dataFim);
                        const horaInicioStr = `${String(inicio.getHours()).padStart(2,'0')}:${String(Math.floor(inicio.getMinutes()/15)*15).padStart(2,'0')}`;
                        const horaFimStr = `${String(fim.getHours()).padStart(2,'0')}:${String(Math.floor(fim.getMinutes()/15)*15).padStart(2,'0')}`;
                        const idxInicio = HORARIOS.indexOf(horaInicioStr);
                        const idxFim = HORARIOS.indexOf(horaFimStr);
                        if (idxInicio === -1) return null;
                        const slots = idxFim > idxInicio ? idxFim - idxInicio : 2;
                        const top = idxInicio * SLOT_HEIGHT;
                        const height = slots * SLOT_HEIGHT;
                        const left = TIME_COL_WIDTH + profIdx * COL_WIDTH;
                        return (
                          <div
                            key={`bloqueio-${bloqueio.id}-${profissional.id}`}
                            className="absolute bg-gray-200 border-l-4 border-gray-500 p-1 rounded-r text-xs overflow-hidden z-10 flex items-center gap-1"
                            style={{ top: `${top}px`, left: `${left}px`, width: `${COL_WIDTH}px`, height: `${height}px`, opacity: 0.85 }}
                            title={bloqueio.motivo}
                          >
                            <span>🔒</span>
                            <span className="text-gray-600 truncate text-[10px]">{bloqueio.motivo}</span>
                            <button
                              className="ml-auto text-gray-400 hover:text-red-500"
                              onClick={(e) => { e.stopPropagation(); deleteBloqueioMutation.mutate(bloqueio.id); }}
                              title="Remover bloqueio"
                            >✕</button>
                          </div>
                        );
                      })}
                  </>
                );
              })}
              </div>
            </div>
          </div>
        </div>}
      </div>

      {/* Vista Semanal */}
      {viewMode === 'semana' && (
        <div className="bg-white rounded-xl shadow overflow-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <button
              onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d); }}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <ChevronLeft size={16} /> Semana anterior
            </button>
            <span className="font-semibold text-gray-800 text-sm">
              {diasDaSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {diasDaSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d); }}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Próxima semana <ChevronRight size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-16 p-2 border text-gray-500 font-medium sticky left-0 bg-gray-50 z-10">Hora</th>
                  {diasDaSemana.map((dia, i) => {
                    const isHoje = dia.toDateString() === new Date().toDateString();
                    return (
                      <th key={i} className={`p-2 border font-medium text-center ${isHoje ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}>
                        <div>{DIAS_SEMANA[dia.getDay()]}</div>
                        <div className={`text-base font-bold ${isHoje ? 'text-indigo-600' : ''}`}>{dia.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HORARIOS_SEMANA.map((hora) => (
                  <tr key={hora} className="hover:bg-gray-50/50">
                    <td className="p-1 border text-right text-gray-500 font-medium bg-gray-50 sticky left-0 z-10 text-[11px]">{hora}</td>
                    {diasDaSemana.map((dia, dIdx) => {
                      const dateStr = dia.toISOString().split('T')[0];
                      const agendsDia = allAgendamentos.filter(a => {
                        if (!a.dataHora) return false;
                        if (a.dataHora.split('T')[0] !== dateStr) return false;
                        if (a.status === 'convertido' || a.status === 'cancelado') return false;
                        const h = a.dataHora.split('T')[1]?.substring(0, 5);
                        return h === hora;
                      });
                      return (
                        <td key={dIdx} className="border p-0.5 align-top min-w-[90px]"
                          onClick={() => { setSelectedDate(dia); setViewMode('dia'); }}>
                          {agendsDia.map(a => {
                            const cor = servicos.find(s => s.id === a.servicoId)?.cor || '#6366f1';
                            return (
                              <div key={a.id}
                                className="rounded p-1 mb-0.5 cursor-pointer text-[10px] truncate"
                                style={{ backgroundColor: cor + '25', borderLeft: `3px solid ${cor}` }}
                                onClick={(e) => { e.stopPropagation(); openModal(a); }}
                                title={`${getClienteNome(a.clienteId)} — ${getServicoNome(a.servicoId)}`}
                              >
                                <div className="font-semibold truncate" style={{ color: cor }}>{getClienteNome(a.clienteId)}</div>
                                <div className="text-gray-500 truncate">{getServicoNome(a.servicoId)}</div>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Bloqueio de Horário */}
      {isBloqueioModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">🔒 Bloquear Horário</h2>
              <button onClick={() => setIsBloqueioModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
                <select value={bloqueioForm.profissionalId}
                  onChange={(e) => setBloqueioForm({ ...bloqueioForm, profissionalId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="">Todos os profissionais</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
                <input type="datetime-local" value={bloqueioForm.dataInicio}
                  onChange={(e) => setBloqueioForm({ ...bloqueioForm, dataInicio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
                <input type="datetime-local" value={bloqueioForm.dataFim}
                  onChange={(e) => setBloqueioForm({ ...bloqueioForm, dataFim: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input type="text" value={bloqueioForm.motivo}
                  onChange={(e) => setBloqueioForm({ ...bloqueioForm, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Bloqueado" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="diaInteiro" checked={bloqueioForm.diaInteiro}
                  onChange={(e) => {
                    const di = e.target.checked;
                    const dateStr = bloqueioForm.dataInicio.split('T')[0] || selectedDate.toISOString().split('T')[0];
                    setBloqueioForm({ ...bloqueioForm, diaInteiro: di,
                      dataInicio: di ? `${dateStr}T00:00` : bloqueioForm.dataInicio,
                      dataFim: di ? `${dateStr}T23:59` : bloqueioForm.dataFim });
                  }}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded" />
                <label htmlFor="diaInteiro" className="text-sm text-gray-700">Dia inteiro</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsBloqueioModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={() => createBloqueioMutation.mutate({
                    profissionalId: bloqueioForm.profissionalId || null,
                    dataInicio: bloqueioForm.dataInicio,
                    dataFim: bloqueioForm.dataFim,
                    motivo: bloqueioForm.motivo || 'Bloqueado',
                    diaInteiro: bloqueioForm.diaInteiro,
                  })}
                  disabled={createBloqueioMutation.isPending || !bloqueioForm.dataInicio || !bloqueioForm.dataFim}
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {createBloqueioMutation.isPending ? 'Salvando...' : 'Bloquear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                {editingAgendamento?.isAtendimento ? 'Visualizar Atendimento' : (editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento')}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={formData.clienteId}
                  onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.telefone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serviço *</label>
                <select
                  value={formData.servicoId}
                  onChange={(e) => setFormData({ ...formData, servicoId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map((servico) => (
                    <option key={servico.id} value={servico.id}>
                      {servico.nome} - R$ {servico.preco?.toFixed(2)} ({servico.duracao}min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profissional *</label>
                <select
                  value={formData.profissionalId}
                  onChange={(e) => setFormData({ ...formData, profissionalId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                  required
                >
                  <option value="">Selecione um profissional</option>
                  {profissionais.map((profissional) => (
                    <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auxiliar</label>
                <select
                  value={formData.auxiliarId}
                  onChange={(e) => setFormData({ ...formData, auxiliarId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                >
                  <option value="">Sem auxiliar</option>
                  {profissionais
                    .filter(p => p.id !== formData.profissionalId)
                    .filter(p => 
                      p.especialidade?.toLowerCase().includes('auxiliar') || 
                      p.especialidade?.toLowerCase().includes('assistente')
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
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
                  disabled={editingAgendamento?.isAtendimento}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                >
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Observações sobre o agendamento..."
                  disabled={editingAgendamento?.isAtendimento}
                />
              </div>

              {aviso.mensagem && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  aviso.tipo === 'erro' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  <AlertCircle size={18} />
                  {aviso.mensagem}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {editingAgendamento && !editingAgendamento.isAtendimento && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingAgendamento.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    Excluir
                  </button>
                )}
                {editingAgendamento && !editingAgendamento.isAtendimento && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Converter este agendamento em atendimento?')) {
                        converterUmMutation.mutate({ id: editingAgendamento.id, navigateAfter: true });
                        closeModal();
                      }
                    }}
                    disabled={converterUmMutation.isPending}
                    className="px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    {converterUmMutation.isPending ? 'Convertendo...' : 'Converter p/ Atendimento'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || editingAgendamento?.isAtendimento}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingAgendamento?.isAtendimento ? 'Apenas Visualização' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
