import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, User, Phone, Scissors, CheckCircle, XCircle,
  AlertCircle, ChevronRight, RefreshCw, Inbox
} from 'lucide-react';
import api from '../services/api';

const TABS = [
  { key: 'pendente',  label: 'Pendentes' },
  { key: 'aprovado',  label: 'Aprovadas' },
  { key: 'rejeitado', label: 'Rejeitadas' },
  { key: '',          label: 'Todas' },
];

function formatDateTime(dataHora) {
  if (!dataHora) return '—';
  const d = new Date(dataHora);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status }) {
  const cfg = {
    pendente:  { label: 'Pendente',  bg: 'bg-yellow-100', text: 'text-yellow-800' },
    aprovado:  { label: 'Aprovado',  bg: 'bg-green-100',  text: 'text-green-800'  },
    rejeitado: { label: 'Rejeitado', bg: 'bg-red-100',    text: 'text-red-800'    },
  }[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function PedidoCard({ pedido, onAtualizado }) {
  const [state, setState] = useState({
    verificando: false,
    disponibilidade: null,
    buscandoProximo: false,
    proximoHorario: null,
    aceitando: false,
    rejeitando: false,
    motivo: '',
    confirmandoRejeicao: false,
    erro: '',
  });

  const set = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const verificarDisponibilidade = async () => {
    set({ verificando: true, disponibilidade: null, proximoHorario: null, erro: '' });
    try {
      const res = await api.get(`/app/pedidos/${pedido.id}/verificar-disponibilidade`);
      set({ disponibilidade: res.data, verificando: false });
    } catch (e) {
      set({ verificando: false, erro: e.response?.data?.error || 'Erro ao verificar' });
    }
  };

  const buscarProximoHorario = async () => {
    set({ buscandoProximo: true, erro: '' });
    try {
      const res = await api.get(`/app/pedidos/${pedido.id}/proximo-horario`);
      set({ proximoHorario: res.data.dataHora, buscandoProximo: false });
    } catch (e) {
      set({ buscandoProximo: false, erro: e.response?.data?.error || 'Nenhum horário disponível' });
    }
  };

  const aceitar = async (dataHoraOverride) => {
    set({ aceitando: true, erro: '' });
    try {
      const body = {};
      if (dataHoraOverride) body.dataHora = dataHoraOverride;
      await api.put(`/app/pedidos/${pedido.id}/aprovar`, body);
      onAtualizado();
    } catch (e) {
      set({ aceitando: false, erro: e.response?.data?.error || 'Erro ao aceitar' });
    }
  };

  const rejeitar = async () => {
    set({ confirmandoRejeicao: true, erro: '' });
    try {
      await api.put(`/app/pedidos/${pedido.id}/rejeitar`, { motivo: state.motivo });
      onAtualizado();
    } catch (e) {
      set({ confirmandoRejeicao: false, erro: e.response?.data?.error || 'Erro ao rejeitar' });
    }
  };

  const isPendente = pedido.status === 'pendente';

  return (
    <div
      className="rounded-xl shadow-sm border p-5"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Header do card */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {(pedido.clienteNome || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{pedido.clienteNome || 'Cliente desconhecido'}</p>
            {pedido.clienteTelefone && (
              <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-light)' }}>
                <Phone size={11} /> {pedido.clienteTelefone}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={pedido.status} />
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Scissors size={14} style={{ color: 'var(--color-primary)' }} />
          <span className="truncate">{pedido.servicoNome || '—'}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
          <span>{formatDate(pedido.dataDesejada)} às {pedido.horarioDesejado?.slice(0,5) || '—'}</span>
        </div>
        {pedido.profissionalNome && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <User size={14} style={{ color: 'var(--color-primary)' }} />
            <span className="truncate">{pedido.profissionalNome}</span>
          </div>
        )}
        {pedido.horarioAlternativo && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-text-light)' }}>
            <Clock size={14} />
            <span>Alt: {pedido.horarioAlternativo?.slice(0,5)}</span>
          </div>
        )}
      </div>

      {pedido.observacoes && (
        <p className="text-xs italic mb-4 px-3 py-2 rounded-lg" style={{ color: 'var(--color-text-light)', backgroundColor: 'var(--color-background)' }}>
          "{pedido.observacoes}"
        </p>
      )}

      {/* Área de ações (apenas pendentes) */}
      {isPendente && (
        <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          {state.erro && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={13} /> {state.erro}
            </p>
          )}

          {/* Botão verificar disponibilidade */}
          {!state.disponibilidade && (
            <button
              onClick={verificarDisponibilidade}
              disabled={state.verificando}
              className="w-full text-sm font-medium py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {state.verificando
                ? <><RefreshCw size={14} className="animate-spin" /> Verificando...</>
                : <><CheckCircle size={14} /> Verificar Disponibilidade</>}
            </button>
          )}

          {/* Resultado da verificação */}
          {state.disponibilidade && (
            <div>
              {state.disponibilidade.disponivel ? (
                <div className="rounded-lg p-3 bg-green-50 border border-green-200 mb-3">
                  <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle size={15} /> Horário disponível
                    {state.disponibilidade.semProfissional && ' (sem preferência de profissional)'}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg p-3 bg-red-50 border border-red-200 mb-3">
                  <p className="text-sm text-red-700 font-medium flex items-center gap-1">
                    <XCircle size={15} /> Horário ocupado
                  </p>
                  {state.disponibilidade.conflito && (
                    <p className="text-xs text-red-600 mt-1">
                      Conflito: {state.disponibilidade.conflito.servicoNome} às {formatDateTime(state.disponibilidade.conflito.dataHora)}
                    </p>
                  )}
                </div>
              )}

              {/* Próximo horário */}
              {!state.disponibilidade.disponivel && !state.proximoHorario && (
                <button
                  onClick={buscarProximoHorario}
                  disabled={state.buscandoProximo}
                  className="w-full text-sm font-medium py-2 px-4 rounded-lg border mb-2 transition-colors flex items-center justify-center gap-2"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  {state.buscandoProximo
                    ? <><RefreshCw size={14} className="animate-spin" /> Buscando...</>
                    : <><ChevronRight size={14} /> Ver Próximo Horário Vago</>}
                </button>
              )}

              {state.proximoHorario && (
                <div className="rounded-lg p-3 bg-blue-50 border border-blue-200 mb-3">
                  <p className="text-sm text-blue-700 font-medium">
                    Próximo disponível: {formatDateTime(state.proximoHorario)}
                  </p>
                  <button
                    onClick={() => aceitar(state.proximoHorario)}
                    disabled={state.aceitando}
                    className="mt-2 w-full text-sm font-medium py-1.5 px-4 rounded-lg text-white flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    {state.aceitando
                      ? <><RefreshCw size={13} className="animate-spin" /> Agendando...</>
                      : <><CheckCircle size={13} /> Aceitar com este horário</>}
                  </button>
                </div>
              )}

              {/* Aceitar com horário original (se disponível) */}
              {state.disponibilidade.disponivel && (
                <button
                  onClick={() => aceitar(null)}
                  disabled={state.aceitando}
                  className="w-full text-sm font-medium py-2 px-4 rounded-lg text-white mb-2 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  {state.aceitando
                    ? <><RefreshCw size={14} className="animate-spin" /> Agendando...</>
                    : <><CheckCircle size={14} /> Aceitar</>}
                </button>
              )}
            </div>
          )}

          {/* Rejeitar */}
          {!state.rejeitando ? (
            <button
              onClick={() => set({ rejeitando: true })}
              className="w-full text-sm font-medium py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              <XCircle size={14} /> Rejeitar
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={state.motivo}
                onChange={(e) => set({ motivo: e.target.value })}
                placeholder="Motivo da rejeição (opcional)"
                className="w-full text-sm border rounded-lg p-2 resize-none"
                rows={2}
                style={{ borderColor: 'var(--color-border)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={rejeitar}
                  disabled={state.confirmandoRejeicao}
                  className="flex-1 text-sm font-medium py-1.5 rounded-lg text-white flex items-center justify-center gap-1"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  {state.confirmandoRejeicao ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={13} />}
                  Confirmar
                </button>
                <button
                  onClick={() => set({ rejeitando: false, motivo: '' })}
                  className="flex-1 text-sm py-1.5 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info aprovação/rejeição */}
      {pedido.status === 'aprovado' && pedido.agendamentoId && (
        <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle size={13} /> Convertido em agendamento
          </p>
        </div>
      )}
      {pedido.status === 'rejeitado' && pedido.motivoRejeicao && (
        <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-red-600">Motivo: {pedido.motivoRejeicao}</p>
        </div>
      )}
    </div>
  );
}

export default function Solicitacoes() {
  const [tabAtiva, setTabAtiva] = useState('pendente');
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = tabAtiva ? { status: tabAtiva } : {};
      const res = await api.get('/app/pedidos/salao', { params });
      setPedidos(res.data.data || []);
    } catch {}
    setCarregando(false);
  }, [tabAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const pendentesCount = pedidos.filter((p) => p.status === 'pendente').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Inbox size={24} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Solicitações de Agendamento
          </h1>
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {TABS.map((tab) => {
          const isActive = tabAtiva === tab.key;
          const count = tab.key === 'pendente' ? pendentesCount : null;
          return (
            <button
              key={tab.key}
              onClick={() => setTabAtiva(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
              style={{
                borderBottomColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-light)',
              }}
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex justify-center py-16">
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-16">
          <Inbox size={48} className="mx-auto mb-3" style={{ color: 'var(--color-border)' }} />
          <p className="text-lg" style={{ color: 'var(--color-text-light)' }}>Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pedidos.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido} onAtualizado={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
