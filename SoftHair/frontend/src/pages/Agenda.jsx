import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { agendamentosAPI, clientesAPI, servicosAPI, profissionaisAPI, atendimentosAPI } from '../services/api';
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
  { bg: 'bg-pink-50 dark:bg-pink-900/30', border: 'border-pink-300', text: 'text-pink-700', accent: '#f472b6' },
  { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', accent: '#fb7185' },
  { bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-300', text: 'text-purple-700', accent: '#c084fc' },
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
    // Maquiador(a) / Designer de Sobrancelha
    { patterns: [/maqui[ae]/i, /designer/i, /sobrancelh/i], normalized: 'Maquiador' },
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
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function SearchSelect({ value, onChange, options, placeholder, disabled, renderLabel }) {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const ref = React.useRef(null);

  const selected = options.find(o => o.id === value);

  React.useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = options.filter(o =>
    renderLabel(o).toLowerCase().includes(search.toLowerCase())
  );

  const displayValue = focused ? search : (selected ? renderLabel(selected) : '');

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); setSearch(''); }}
        placeholder={selected ? renderLabel(selected) : placeholder}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[9999] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
          {filtered.map(o => (
            <div
              key={o.id}
              className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:bg-indigo-900/30 text-sm ${o.id === value ? 'bg-indigo-100 font-medium text-indigo-700' : 'text-gray-800 dark:text-gray-100'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.id);
                setOpen(false);
                setFocused(false);
                setSearch('');
              }}
            >
              {renderLabel(o)}
            </div>
          ))}
        </div>
      )}
      {open && search.length > 0 && filtered.length === 0 && (
        <div className="absolute z-[9999] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
          Nenhum resultado
        </div>
      )}
    </div>
  );
}

function ClienteSearchSelect({ value, onChange, selectedCliente, disabled }) {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef(null);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const doSearch = React.useCallback((text) => {
    clearTimeout(timerRef.current);
    if (!text || text.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { clientesAPI } = await import('../services/api');
        const res = await clientesAPI.getAll({ search: text, limit: 20 });
        const raw = res.data?.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setResults(list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, []);

  const displayLabel = (c) => `${c.nome}${c.telefone ? ' — ' + c.telefone : ''}`;
  const displayValue = focused ? search : (selectedCliente ? displayLabel(selectedCliente) : '');

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); doSearch(e.target.value); }}
        onFocus={() => { setFocused(true); setOpen(true); setSearch(''); setResults([]); }}
        placeholder={selectedCliente ? displayLabel(selectedCliente) : 'Buscar cliente por nome...'}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-[9999] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
          {loading && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Buscando...</div>}
          {!loading && results.length === 0 && search.length > 0 && (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum resultado</div>
          )}
          {!loading && results.length === 0 && search.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Digite para buscar</div>
          )}
          {results.map(c => (
            <div
              key={c.id}
              className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:bg-indigo-900/30 text-sm ${c.id === value ? 'bg-indigo-100 font-medium text-indigo-700' : 'text-gray-800 dark:text-gray-100'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.id, c);
                setOpen(false);
                setFocused(false);
                setSearch('');
              }}
            >
              {displayLabel(c)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServicoSearchSelect({ value, onChange, selectedServico, disabled }) {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef(null);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setFocused(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const doSearch = React.useCallback((text) => {
    clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { servicosAPI } = await import('../services/api');
        const res = await servicosAPI.getAll({ search: text || '', limit: 30 });
        const raw = res.data?.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setResults(list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, []);

  const displayLabel = (s) => {
    const preco = s.preco ? ` — R$ ${parseFloat(s.preco).toFixed(2)}` : '';
    const dur = s.duracao_minutos || s.duracao;
    const durStr = dur ? ` (${dur}min)` : '';
    return `${s.nome}${preco}${durStr}`;
  };
  const displayValue = focused ? search : (selectedServico ? displayLabel(selectedServico) : '');

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); doSearch(e.target.value); }}
        onFocus={() => { setFocused(true); setOpen(true); setSearch(''); doSearch(''); }}
        placeholder={selectedServico ? displayLabel(selectedServico) : 'Buscar serviço por nome...'}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-[9999] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
          {loading && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Buscando...</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum resultado</div>}
          {results.map(s => (
            <div
              key={s.id}
              className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:bg-indigo-900/30 text-sm ${s.id === value ? 'bg-indigo-100 font-medium text-indigo-700' : 'text-gray-800 dark:text-gray-100'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.id, s);
                setOpen(false); setFocused(false); setSearch('');
              }}
            >
              {displayLabel(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Agenda() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Atualizar agenda em tempo real via WebSocket
  useWebSocket('admin', 'salao', (msg) => {
    if (msg.type === 'AGENDAMENTO_ATUALIZADO' || msg.type === 'NOVO_PEDIDO_AGENDAMENTO' ||
        msg.tipo === 'agendamento_atualizado' || msg.tipo === 'novo_pedido_agendamento') {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
      queryClient.invalidateQueries(['solicitacoes']);
    }
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfissionais, setSelectedProfissionais] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState(null);
  const [selectedProfissionalCelula, setSelectedProfissionalCelula] = useState(null);
  const [selectedHoraCelula, setSelectedHoraCelula] = useState(null);
  const [selectedClienteObj, setSelectedClienteObj] = useState(null);
  const [selectedServicoObj, setSelectedServicoObj] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  const [agendamentosConvertidos, setAgendamentosConvertidos] = useState([]);
  const [hoveredAgendamento, setHoveredAgendamento] = useState(null);
  const gridRef = useRef(null);
  const autoConvertRef = useRef(false);
  const allAgendamentosRef = useRef([]);
  
  const COL_WIDTH = 96;
  const TIME_COL_WIDTH = 56;

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
    refetchInterval: 120000,
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
    queryFn: () => servicosAPI.getAll({}),
  });

  const { data: profissionaisData } = useQuery({
    queryKey: ['profissionais-dropdown'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const { data: configData } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => import('../services/api').then(m => m.saloesAPI.getMe()),
    refetchInterval: 60000,
  });

  const { data: atendimentosData, refetch: refetchAtendimentos } = useQuery({
    queryKey: ['atendimentos-agenda', selectedDate.toISOString().split('T')[0]],
    queryFn: () => atendimentosAPI.getAll({ data: selectedDate.toISOString().split('T')[0], comServicos: true }),
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => agendamentosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
      closeModal();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.response?.data?.message || (typeof err.response?.data === 'string' ? err.response.data : null) || err.message || 'Erro ao criar agendamento';
      setAviso({ tipo: 'erro', mensagem: msg });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => agendamentosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
      closeModal();
    },
    onError: (err) => {
      setAviso({ tipo: 'erro', mensagem: err.response?.data?.error || err.message || 'Erro ao atualizar agendamento' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => agendamentosAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['agendamentos-dashboard']);
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Erro ao deletar agendamento');
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      deleteMutation.mutate(id);
      setIsModalOpen(false);
      setEditingAgendamento(null);
    }
  };

  const converterUmMutation = useMutation({
    mutationFn: async ({ id }) => {
      // Busca o agendamento para pegar dados
      const ag = await agendamentosAPI.getById(id);
      const data = ag?.data?.data;
      if (!data) throw new Error('Agendamento não encontrado');

      // Cria atendimento a partir do agendamento
      const atend = await atendimentosAPI.create({
        cliente_id: data.clienteId || data.cliente_id,
        profissional_id: data.profissionalId || data.profissional_id,
        servico_id: data.servicoId || data.servico_id,
        agendamento_id: id,
        valor: data.valor || 0,
        status: 'em_andamento',
      });

      // Atualiza status do agendamento
      await agendamentosAPI.update(id, { status: 'em_andamento' });
      return atend;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['agendamentos']);
      queryClient.invalidateQueries(['atendimentos']);
      setNotificacao({ tipo: 'success', mensagem: 'Agendamento convertido em atendimento.' });
    },
    onError: (err) => {
      setNotificacao({ tipo: 'error', mensagem: err.response?.data?.error || err.message || 'Erro ao converter agendamento.' });
    },
  });

  const converterMutation = useMutation({
    mutationFn: async () => {
      const pendentes = (data?.data?.data || []).filter(a => a.status === 'agendado' || a.status === 'confirmado');
      const resultados = [];
      for (const a of pendentes) {
        try {
          await converterUmMutation.mutateAsync({ id: a.id });
          resultados.push({ id: a.id, ok: true });
        } catch (e) {
          resultados.push({ id: a.id, ok: false, error: e.message });
        }
      }
      return { resultados };
    },
    onSuccess: (res) => {
      const ok = res.resultados.filter(r => r.ok).length;
      setNotificacao({ tipo: 'success', mensagem: `${ok} agendamento(s) convertido(s).` });
    },
  });

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    window.scrollTo(0, 0);
    if (searchParams.get('new') === '1') { openModal(); setSearchParams({}); }
  }, []);

  useEffect(() => {
    if (notificacao) {
      const timer = setTimeout(() => setNotificacao(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notificacao]);

  const mapAgendamento = (a) => ({
    ...a,
    dataHora: a.dataHora || a.data_hora,
    clienteId: a.clienteId || a.cliente_id,
    profissionalId: a.profissionalId || a.profissional_id,
    auxiliarId: a.auxiliarId || a.auxiliar_id,
    servicoId: a.servicoId || a.servico_id,
    clienteNome: a.clienteNome || a.cliente_nome,
    profissionalNome: a.profissionalNome || a.profissional_nome,
    servicoNome: a.servicoNome || a.servico_nome,
    servicoDuracao: a.servicoDuracao || a.duracao_minutos,
  });

  const allAgendamentos = (Array.isArray(agendamentosData?.data?.data) ? agendamentosData.data.data : []).map(mapAgendamento);

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
  const clientesRaw = clientesData?.data?.data;
  const clientes = Array.isArray(clientesRaw) ? clientesRaw : Array.isArray(clientesRaw?.data) ? clientesRaw.data : [];
  const servicos = Array.isArray(servicosData?.data?.data) ? servicosData.data.data : [];
  const atendimentosDoDia = Array.isArray(atendimentosData?.data?.data) ? atendimentosData.data.data : [];

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

  const { groupedProfissionais, sortedProfissionais } = useMemo(() => {
    const seen = {};
    [...visibleProfissionais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(p => {
      const rawRole = p.especialidade || 'Outros';
      const role = normalizeRole(rawRole);
      if (!seen[role]) seen[role] = { role, profissionais: [] };
      seen[role].profissionais.push(p);
    });
    const grouped = Object.values(seen).sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : 0));
    return {
      groupedProfissionais: grouped,
      sortedProfissionais: grouped.flatMap(g => g.profissionais),
    };
  }, [visibleProfissionais]);

  const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const getAgendamentosDoDia = (date, profissionalId) => {
    const dateStr = localDateStr(date);
    return allAgendamentos.filter(a => {
      if (!a.dataHora) return false;
      const agendDate = a.dataHora.substring(0, 10);
      if (agendDate !== dateStr) return false;
      if (profissionalId && a.profissionalId !== profissionalId) return false;
      if (a.status === 'convertido') return false;
      if (statusFilter !== 'todos' && a.status !== statusFilter) return false;
      return true;
    });
  };

  const getDuracaoSlots = (agendamento) => {
    const servico = servicos.find(s => s.id === agendamento.servicoId);
    const duracaoMin = servico?.duracao_minutos || servico?.duracao
      || agendamento.servicoDuracao || agendamento.duracao_minutos || 30;
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
      // Backend retorna UTC. Input datetime-local espera horário LOCAL — converter.
      let dataHoraLocal = '';
      if (agendamento.dataHora) {
        const d = new Date(agendamento.dataHora);
        if (!Number.isNaN(d.getTime())) {
          const p = (n) => String(n).padStart(2, '0');
          dataHoraLocal = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
        }
      }
      setFormData({
        clienteId: agendamento.clienteId || '',
        servicoId: agendamento.servicoId || '',
        profissionalId: agendamento.profissionalId || '',
        auxiliarId: agendamento.auxiliarId || '',
        dataHora: dataHoraLocal,
        observacoes: agendamento.observacoes || '',
        status: agendamento.status || 'agendado',
      });
    } else {
      setEditingAgendamento(null);
      const defaultDate = date || selectedDate;
      const defaultTime = hora || '09:00';
      const defaultProfissional = profissional?.id || selectedProfissionalCelula?.id || sortedProfissionais[0]?.id || '';
      
      if (hora && profissional) {
        setSelectedProfissionalCelula(profissional);
        setSelectedHoraCelula(hora);
      }
      
      setFormData({
        clienteId: '',
        servicoId: '',
        profissionalId: defaultProfissional,
        auxiliarId: '',
        dataHora: `${localDateStr(defaultDate)}T${defaultTime}`,
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
    setSelectedClienteObj(null);
    setSelectedServicoObj(null);
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

    // datetime-local não carrega timezone — converter pra ISO 8601 UTC pra evitar
    // o backend (Render = UTC) interpretar "14:00 local" como "14:00 UTC" (= 11:00 BRT).
    const isoDataHora = formData.dataHora
      ? new Date(formData.dataHora).toISOString()
      : null;

    const payload = {
      cliente_id: formData.clienteId,
      servico_id: formData.servicoId,
      profissional_id: formData.profissionalId,
      auxiliar_id: formData.auxiliarId || null,
      data_hora: isoDataHora,
      observacoes: formData.observacoes,
      status: formData.status,
    };

    if (editingAgendamento) {
      updateMutation.mutate({ id: editingAgendamento.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const getCountAgendamentosNoDia = (date) => {
    const dateStr = localDateStr(date);
    return allAgendamentos.filter(a => a.dataHora?.substring(0,10) === dateStr).length;
  };

  return (
    <div className="space-y-4">
      {notificacao && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 max-w-md animate-pulse ${
          notificacao.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
        }`}>
          {notificacao.tipo === 'success' ? (
            <Check size={20} className="text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
          )}
          <span className="flex-1">{notificacao.mensagem}</span>
          <button onClick={() => setNotificacao(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
            <X size={18} />
          </button>
        </div>
      )}

      {pendentesData?.data?.data?.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-600 dark:text-yellow-400" size={20} />
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
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 font-medium flex items-center gap-2">
            <Check size={18} />
            {agendamentosConvertidos.length} atendimento(s) criado(s) automaticamente dos agendamentos
          </p>
          <button 
            onClick={() => setAgendamentosConvertidos([])}
            className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 mt-1"
          >
            Ocultar mensagem
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Agenda</h1>
        <button 
          onClick={() => openModal(null, selectedDate)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={18} />
          Novo Agendamento
        </button>
      </div>

      <div className="flex gap-4">
        <div className="w-72 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 hover:bg-pink-50 dark:bg-pink-900/30 rounded-lg transition-colors">
                <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
              </button>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                {MESES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <button onClick={nextMonth} className="p-2 hover:bg-pink-50 dark:bg-pink-900/30 rounded-lg transition-colors">
                <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 py-1">{d}</div>
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
                      ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:bg-pink-900/30'}
                      ${isToday(date) ? 'bg-pink-100 text-pink-700 font-semibold' : ''}
                      ${isSelected(date) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                    `}
                  >
                    {date.getDate()}
                    {count > 0 && isCurrentMonth && (
                      <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected(date) || isToday(date) ? 'bg-white dark:bg-gray-800' : 'bg-indigo-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-gray-500 dark:text-gray-400 dark:text-gray-500" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Filtros</h3>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase mb-2 block">Tipo</label>
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
                      className="text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase mb-2 block">Profissionais</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProfissionais.length === 0}
                    onChange={() => setSelectedProfissionais([])}
                    className="rounded text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">Todos</span>
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
                        className="rounded text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                      />
                      <span className={`w-3 h-3 rounded-full ${color.bg}`} style={{ borderLeft: `3px solid ${color.accent}` }} />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{p.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase mb-2 block">Status</label>
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
                      className="rounded text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                    />
                    <span className={`w-3 h-3 rounded-full ${opt.color}`} />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="agenda-grid-wrapper flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden"
          style={{
            minWidth: 0,
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 2px 32px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.9) inset',
          }}
        >
          <div className="overflow-auto flex-1" ref={gridRef} style={{ overflowX: 'auto', overflowY: 'auto' }}>
            <div style={{ minWidth: TIME_COL_WIDTH + (sortedProfissionais.length * COL_WIDTH), minHeight: '100%' }}>
              {/* Header sticky */}
              <div className="sticky top-0 z-30" style={{ background: 'rgba(250,250,252,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {/* Linha 1: grupos */}
                <div className="flex">
                  <div className="w-20 flex-shrink-0" style={{ minHeight: 34, borderRight: '1px solid rgba(0,0,0,0.05)' }} />
                  {groupedProfissionais.map(({ role, profissionais: profs }) => {
                    const roleColor = getRoleColor(role);
                    return (
                      <div
                        key={role}
                        className="flex items-center justify-center"
                        style={{
                          width: profs.length * COL_WIDTH,
                          minWidth: profs.length * COL_WIDTH,
                          height: 34,
                          borderRight: '1px solid rgba(255,255,255,0.4)',
                          background: `${roleColor.bg}18`,
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <span
                          className="text-[10px] font-bold tracking-widest uppercase"
                          style={{ color: roleColor.bg }}
                        >
                          {role}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Linha 2: profissionais */}
                <div className="flex">
                  <div className="w-20 flex-shrink-0 flex items-center justify-end pr-3" style={{ borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(100,100,120,0.5)', textTransform: 'uppercase' }}>Hora</span>
                  </div>
                  {sortedProfissionais.map((profissional, idx) => {
                    const roleColor = getRoleColor(normalizeRole(profissional.especialidade || ''));
                    return (
                      <div
                        key={profissional.id}
                        className="min-w-[96px] w-[96px] py-2 text-center"
                        style={{ borderRight: '1px solid rgba(255,255,255,0.4)', background: `${roleColor.bg}10` }}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                            style={{ background: `${roleColor.bg}25`, border: `1.5px solid ${roleColor.bg}40` }}
                          >
                            <User size={14} style={{ color: roleColor.bg }} />
                          </div>
                          <span className="text-gray-700 dark:text-gray-200" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '-0.01em' }}>
                            {profissional.nome?.split(' ')[0]}
                          </span>
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
                      className="agenda-row flex"
                      style={{
                        height: SLOT_HEIGHT,
                        borderBottom: isHour
                          ? '1px solid rgba(0,0,0,0.08)'
                          : isHalfHour
                          ? '1px solid rgba(0,0,0,0.04)'
                          : '1px solid rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        className="agenda-time-col w-20 flex-shrink-0 flex items-start justify-end pr-3 pt-0.5"
                        style={{ borderRight: '1px solid rgba(0,0,0,0.05)', background: 'rgba(248,248,252,0.6)' }}
                      >
                        {isHour ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(50,50,80,0.55)', letterSpacing: '-0.01em' }}>{hora}</span>
                        ) : isHalfHour ? (
                          <span style={{ fontSize: 9, color: 'rgba(100,100,130,0.3)' }}>{hora}</span>
                        ) : null}
                      </div>
                      {sortedProfissionais.map((profissional) => (
                        <div
                          key={profissional.id}
                          className="min-w-[96px] w-[96px] relative cursor-pointer agenda-cell hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                          style={{
                            borderRight: '1px solid rgba(0,0,0,0.04)',
                            background: isHour && Math.floor(horaIdx / 4) % 2 === 0
                              ? 'rgba(255,255,255,0.4)'
                              : 'rgba(248,248,252,0.25)',
                          }}
                          onClick={() => openModal(null, selectedDate, hora, profissional)}
                        />
                      ))}
                    </div>
                  );
                })}
                
                {sortedProfissionais.map((profissional, profIdx) => {
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
                  const dateStr = localDateStr(selectedDate);
                  allAgendamentos.forEach(a => {
                    if (a.status === 'convertido' && a.auxiliarId === profissional.id && a.dataHora && a.dataHora.substring(0,10) === dateStr) {
                      const hora = a.dataHora.split('T')[1]?.substring(0, 5);
                      if (hora) convertedAuxTimes.add(hora);
                    }
                  });

                  return (
                    <React.Fragment key={profissional.id}>
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
                          ? { bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-400 dark:border-red-600', text: 'text-red-700 dark:text-red-300', opacity: 'opacity-70', label: null }
                          : isConfirmed
                          ? { bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-500 dark:border-green-600', text: 'text-green-800 dark:text-green-200', opacity: '', label: null }
                          : { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-500 dark:border-yellow-600', text: 'text-yellow-800 dark:text-yellow-200', opacity: '', label: null };

                        return (
                          <div
                            key={agend.id}
                            className={`absolute ${statusStyle.bg} ${statusStyle.border} ${statusStyle.opacity} border-l-4 p-1.5 rounded-r-lg text-xs cursor-pointer transition-all overflow-hidden z-20 hover:brightness-95`}
                            style={{
                              top: `${top}px`,
                              left: `${left}px`,
                              width: `${COL_WIDTH}px`,
                              height: `${height}px`,
                            }}
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
                                  {agend.clienteNome || getClienteNome(agend.clienteId)}
                                </div>
                                <div className={`${statusStyle.text} opacity-75 truncate text-[10px]`}>
                                  {agend.servicoNome || getServicoNome(agend.servicoId)}
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
                                  className="ml-1 p-1 bg-red-100 hover:bg-red-200 rounded text-red-600 dark:text-red-400 flex-shrink-0"
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
                      const dateStr = localDateStr(selectedDate);
                      if (a.status === 'cancelado') return false;
                      if (a.status === 'convertido') return false;
                      return a.dataHora.substring(0,10) === dateStr;
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
                          className="absolute bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 border-l-4 p-1.5 rounded-r-lg text-xs cursor-pointer transition-all overflow-hidden z-20 hover:brightness-95"
                          style={{ top: `${top}px`, left: `${left}px`, width: `${COL_WIDTH}px`, height: `${height}px` }}
                          onClick={(e) => { e.stopPropagation(); openModal(agend); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-yellow-800 truncate text-[11px]">
                              {agend.clienteNome || getClienteNome(agend.clienteId)}
                            </div>
                            <div className="text-yellow-700 opacity-75 truncate text-[10px]">
                              {agend.servicoNome || getServicoNome(agend.servicoId)}
                            </div>
                            <div className="text-yellow-600 dark:text-yellow-400 text-[9px] mt-0.5">
                              aux: {getProfissionalNome(agend.profissionalId)}
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
                                <div className="text-purple-600 dark:text-purple-400 opacity-60 truncate text-[9px]">
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
                  </React.Fragment>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {editingAgendamento?.isAtendimento ? 'Visualizar Atendimento' : (editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento')}
              </h2>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cliente *</label>
                <ClienteSearchSelect
                  value={formData.clienteId}
                  onChange={(id, obj) => { setFormData({ ...formData, clienteId: id }); setSelectedClienteObj(obj); }}
                  selectedCliente={selectedClienteObj}
                  disabled={editingAgendamento?.isAtendimento}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Serviço *</label>
                <ServicoSearchSelect
                  value={formData.servicoId}
                  onChange={(id, obj) => { setFormData({ ...formData, servicoId: id }); setSelectedServicoObj(obj); }}
                  selectedServico={selectedServicoObj}
                  disabled={editingAgendamento?.isAtendimento}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Profissional *</label>
                <select
                  value={formData.profissionalId}
                  onChange={(e) => setFormData({ ...formData, profissionalId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Auxiliar</label>
                <select
                  value={formData.auxiliarId}
                  onChange={(e) => setFormData({ ...formData, auxiliarId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data e Hora *</label>
                <input
                  type="datetime-local"
                  value={formData.dataHora}
                  onChange={(e) => setFormData({ ...formData, dataHora: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={editingAgendamento?.isAtendimento}
                >
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Observações sobre o agendamento..."
                  disabled={editingAgendamento?.isAtendimento}
                />
              </div>

              {aviso.mensagem && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  aviso.tipo === 'erro' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 border border-red-200' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 border border-yellow-200'
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
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100"
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
                    className="px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    {converterUmMutation.isPending ? 'Convertendo...' : 'Converter p/ Atendimento'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
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
