import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Clock, CheckCircle2, Play, Calendar, Plus, Trash2,
  X, AlertCircle, Loader2, DollarSign, Search,
} from 'lucide-react';
import {
  profissionaisAPI, agendamentosAPI, atendimentosAPI,
  servicosAPI, comissoesAPI,
} from '../services/api';

/**
 * PainelDia — visão "dia do profissional" para PC compartilhado.
 * Admin/recepção entra, escolhe profissional no dropdown e vê o dia dele:
 * próximos, em andamento, concluídos. Pode abrir "atendimento atual"
 * e adicionar serviços extras no momento.
 *
 * Não exige login como profissional. ID atual fica em localStorage
 * (persiste entre refreshes na mesma máquina).
 */

const LS_KEY = 'painel_dia_profissional_id';
const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
// Data LOCAL (não UTC) — evita virar dia seguinte à noite no Brasil.
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
// Comissão padronizada: aceita valor_comissao | valor_comissao_cents/100 | valor (legado).
const comissaoValor = (c) => {
  if (c == null) return 0;
  if (c.valor_comissao_cents != null) return Number(c.valor_comissao_cents) / 100;
  if (c.valor_comissao != null) return Number(c.valor_comissao);
  if (c.valor != null) return Number(c.valor);
  return 0;
};

export default function PainelDia() {
  const [profId, setProfId] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? Number(saved) : null;
  });
  const [atendimentoAberto, setAtendimentoAberto] = useState(null);

  const { data: profsResp, isLoading: lProfs } = useQuery({
    queryKey: ['profissionais-painel-dia'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });
  const profissionais = profsResp?.data?.data || [];

  const handleSetProf = (id) => {
    if (!id) {
      localStorage.removeItem(LS_KEY);
      setProfId(null);
    } else {
      const n = Number(id);
      localStorage.setItem(LS_KEY, String(n));
      setProfId(n);
    }
  };

  const profAtual = profissionais.find((p) => p.id === profId);

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <User size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visão do profissional</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {profAtual ? profAtual.nome : 'Selecione um profissional'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Trocar:</label>
          <select
            value={profId || ''}
            onChange={(e) => handleSetProf(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— escolher —</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {lProfs && (
        <div className="text-center py-8 text-gray-500">
          <Loader2 className="animate-spin mx-auto" size={28} />
        </div>
      )}

      {!profId && !lProfs && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
          <User className="mx-auto text-gray-400 mb-3" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Escolha quem está atendendo</h3>
          <p className="text-gray-500 dark:text-gray-400">No PC do salão, troque pelo nome do profissional ativo agora.</p>
        </div>
      )}

      {profId && <PainelDoDia profId={profId} onAbrir={setAtendimentoAberto} />}

      {atendimentoAberto && (
        <AtendimentoModal
          atendimento={atendimentoAberto}
          onClose={() => setAtendimentoAberto(null)}
        />
      )}
    </div>
  );
}

function PainelDoDia({ profId, onAbrir }) {
  const today = todayStr();

  const { data: agendResp, isLoading: lAg } = useQuery({
    queryKey: ['painel-agend', profId, today],
    queryFn: () => agendamentosAPI.getAll({
      profissional_id: profId,
      data_inicio: today,
      data_fim: today,
    }),
  });
  const { data: atendResp, isLoading: lAt } = useQuery({
    queryKey: ['painel-atend', profId, today],
    queryFn: () => atendimentosAPI.getAll({
      profissional_id: profId,
      data_inicio: today,
      data_fim: today,
    }),
  });
  const { data: comResp } = useQuery({
    queryKey: ['painel-com', profId, today],
    queryFn: () => comissoesAPI.getPagas({ profissional_id: profId, data_inicio: today, data_fim: today }),
  });

  const agendamentos = agendResp?.data?.data || [];
  const atendimentos = atendResp?.data?.data || [];
  const comissoesHoje = comResp?.data?.data || [];

  const proximos = agendamentos.filter((a) => {
    const s = (a.status || '').toLowerCase();
    return ['agendado', 'confirmado'].includes(s);
  });
  const emAndamento = atendimentos.filter((a) => ['em_andamento', 'aberto'].includes((a.status || '').toLowerCase()));
  const concluidos = atendimentos.filter((a) => ['finalizado', 'concluido', 'concluida'].includes((a.status || '').toLowerCase()));

  const comissaoEstimada = useMemo(() => {
    return comissoesHoje.reduce((sum, c) => sum + comissaoValor(c), 0);
  }, [comissoesHoje]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Calendar}    label="Agend. hoje"   value={agendamentos.length} accent="indigo" />
        <StatCard icon={Play}        label="Em atendimento" value={emAndamento.length}  accent="amber" />
        <StatCard icon={CheckCircle2} label="Concluídos"    value={concluidos.length}   accent="emerald" />
        <StatCard icon={DollarSign}  label="Comissão hoje" value={fmtMoney(comissaoEstimada)} accent="rose" />
      </div>

      <Section title="Em atendimento" icon={Play} loading={lAt} empty={emAndamento.length === 0} emptyMsg="Nenhum atendimento em andamento.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {emAndamento.map((a) => (
            <AtendimentoCard key={a.id} atendimento={a} onClick={() => onAbrir(a)} highlight />
          ))}
        </div>
      </Section>

      <Section title="Próximos" icon={Clock} loading={lAg} empty={proximos.length === 0} emptyMsg="Nenhum agendamento pendente.">
        <div className="space-y-2">
          {proximos.map((a) => (
            <ProximoRow key={a.id} agendamento={a} />
          ))}
        </div>
      </Section>

      <Section title="Concluídos hoje" icon={CheckCircle2} loading={lAt} empty={concluidos.length === 0} emptyMsg="Ainda não concluiu nenhum atendimento hoje.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {concluidos.map((a) => (
            <AtendimentoCard key={a.id} atendimento={a} onClick={() => onAbrir(a)} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  const colors = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[accent]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, loading, empty, emptyMsg, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-gray-500 dark:text-gray-400" />
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
      {loading ? (
        <div className="text-center py-6 text-gray-500"><Loader2 className="animate-spin mx-auto" size={20} /></div>
      ) : empty ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-3">{emptyMsg}</p>
      ) : children}
    </div>
  );
}

function AtendimentoCard({ atendimento, onClick, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl p-4 border transition-all hover:shadow-md
        ${highlight
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
          : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold">
          {(atendimento.cliente_nome || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {atendimento.cliente_nome || 'Sem cliente'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {atendimento.created_at ? new Date(atendimento.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
            {' · '}
            {fmtMoney(atendimento.valor || 0)}
          </p>
        </div>
      </div>
    </button>
  );
}

function ProximoRow({ agendamento }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center">
        <Calendar size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{agendamento.cliente_nome || 'Cliente'}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {agendamento.data_hora ? new Date(agendamento.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
          {agendamento.servico_nome ? ` · ${agendamento.servico_nome}` : ''}
        </p>
      </div>
      <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
        {agendamento.status}
      </span>
    </div>
  );
}

function AtendimentoModal({ atendimento, onClose }) {
  const qc = useQueryClient();
  const [showAddSvc, setShowAddSvc] = useState(false);
  const { data: itensResp, isLoading: lItens } = useQuery({
    queryKey: ['atendimento-servicos', atendimento.id],
    queryFn: () => atendimentosAPI.listarServicos(atendimento.id),
  });
  const itens = itensResp?.data?.data || [];
  const total = itens.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const totalComissao = itens.reduce((s, i) => s + Number(i.valor_comissao || 0), 0);
  const ativo = ['em_andamento', 'aberto'].includes((atendimento.status || '').toLowerCase());

  const removerMut = useMutation({
    mutationFn: (itemId) => atendimentosAPI.removerServico(atendimento.id, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atendimento-servicos', atendimento.id] });
      qc.invalidateQueries({ queryKey: ['painel-atend'] });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
              {atendimento.cliente_nome || 'Atendimento'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Status: <span className="font-medium">{atendimento.status}</span>
              {atendimento.profissional_nome ? ` · ${atendimento.profissional_nome}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Serviços</h3>
            {lItens ? (
              <div className="text-center py-4 text-gray-500"><Loader2 className="animate-spin mx-auto" size={20} /></div>
            ) : itens.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic py-3">Nenhum serviço adicionado ainda.</p>
            ) : (
              <div className="space-y-2">
                {itens.map((it) => (
                  <div key={it.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {it.nome_snapshot} {it.quantidade > 1 && <span className="text-xs text-gray-500">×{it.quantidade}</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fmtMoney(it.valor_snapshot)} · comissão {fmtMoney(it.valor_comissao)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtMoney(it.subtotal)}</span>
                      {ativo && (
                        <button
                          onClick={() => { if (confirm('Remover este serviço?')) removerMut.mutate(it.id); }}
                          className="text-gray-400 hover:text-rose-600 p-1"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total do atendimento</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{fmtMoney(total)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Comissão estimada</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmtMoney(totalComissao)}</p>
            </div>
          </div>

          {ativo && (
            <button
              onClick={() => setShowAddSvc(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Adicionar serviço
            </button>
          )}
        </div>
      </div>

      {showAddSvc && (
        <AdicionarServicoModal
          atendimentoId={atendimento.id}
          onClose={() => setShowAddSvc(false)}
          onAdded={() => {
            setShowAddSvc(false);
            qc.invalidateQueries({ queryKey: ['atendimento-servicos', atendimento.id] });
            qc.invalidateQueries({ queryKey: ['painel-atend'] });
          }}
        />
      )}
    </div>
  );
}

function AdicionarServicoModal({ atendimentoId, onClose, onAdded }) {
  const [search, setSearch] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState('');

  const { data: svcResp, isLoading } = useQuery({
    queryKey: ['servicos-ativos-pick'],
    queryFn: () => servicosAPI.getAll({ ativo: 'true' }),
  });
  const servicos = svcResp?.data?.data || [];
  const filtered = servicos.filter((s) => (s.nome || '').toLowerCase().includes(search.toLowerCase()));

  const addMut = useMutation({
    mutationFn: (svc) => atendimentosAPI.adicionarServico(atendimentoId, {
      servico_id: svc.id,
      quantidade,
    }),
    onSuccess: () => onAdded(),
    onError: (e) => setErro(e.response?.data?.error || 'Erro ao adicionar serviço'),
  });

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Adicionar serviço</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar serviço..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600 dark:text-gray-300">Quantidade:</label>
            <input
              type="number"
              min={1}
              max={20}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg"
            />
          </div>
          {erro && (
            <div className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-6 text-gray-500"><Loader2 className="animate-spin mx-auto" size={20} /></div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filtered.slice(0, 50).map((s) => (
                <button
                  key={s.id}
                  disabled={addMut.isPending}
                  onClick={() => { setErro(''); addMut.mutate(s); }}
                  className="w-full text-left flex items-center justify-between bg-gray-50 dark:bg-gray-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl p-3 disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.nome}</p>
                    {s.categoria && <p className="text-xs text-gray-500 dark:text-gray-400">{s.categoria}</p>}
                  </div>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{fmtMoney(s.preco)}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Nenhum serviço encontrado.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
