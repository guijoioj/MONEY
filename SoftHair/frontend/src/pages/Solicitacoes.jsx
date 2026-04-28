import { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Phone, Scissors, CheckCircle, XCircle, RefreshCw, Inbox } from 'lucide-react';
import { agendamentosAPI } from '../services/api';

const TABS = [
  { key: 'pendente',   label: 'Pendentes' },
  { key: 'confirmado', label: 'Aprovadas' },
  { key: 'cancelado',  label: 'Rejeitadas' },
  { key: '',           label: 'Todas' },
];

function formatDateTime(dataHora) {
  if (!dataHora) return '—';
  const d = new Date(dataHora);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
  const cfg = {
    pendente:   { label: 'Pendente',  bg: 'bg-yellow-100', text: 'text-yellow-800' },
    confirmado: { label: 'Aprovado',  bg: 'bg-green-100',  text: 'text-green-800'  },
    cancelado:  { label: 'Rejeitado', bg: 'bg-red-100',    text: 'text-red-800'    },
  }[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function PedidoCard({ pedido, onAtualizado }) {
  const [aceitando, setAceitando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmandoRejeicao, setConfirmandoRejeicao] = useState(false);
  const [erro, setErro] = useState('');

  const aceitar = async () => {
    setAceitando(true);
    setErro('');
    try {
      await agendamentosAPI.update(pedido.id, { status: 'confirmado' });
      onAtualizado();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao aceitar');
      setAceitando(false);
    }
  };

  const rejeitar = async () => {
    setConfirmandoRejeicao(true);
    setErro('');
    try {
      await agendamentosAPI.update(pedido.id, { status: 'cancelado', observacoes: motivo });
      onAtualizado();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao rejeitar');
      setConfirmandoRejeicao(false);
    }
  };

  const isPendente = pedido.status === 'pendente';

  return (
    <div
      className="rounded-xl shadow-sm border p-5"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {(pedido.clienteNome || pedido.cliente_nome || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {pedido.clienteNome || pedido.cliente_nome || 'Cliente desconhecido'}
            </p>
            {(pedido.clienteTelefone || pedido.cliente_telefone) && (
              <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-light)' }}>
                <Phone size={11} /> {pedido.clienteTelefone || pedido.cliente_telefone}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={pedido.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Scissors size={14} style={{ color: 'var(--color-primary)' }} />
          <span className="truncate">{pedido.servicoNome || pedido.servico_nome || '—'}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
          <span>{formatDateTime(pedido.dataHora || pedido.data_hora)}</span>
        </div>
        {(pedido.profissionalNome || pedido.profissional_nome) && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <User size={14} style={{ color: 'var(--color-primary)' }} />
            <span className="truncate">{pedido.profissionalNome || pedido.profissional_nome}</span>
          </div>
        )}
      </div>

      {pedido.observacoes && (
        <p className="text-xs italic mb-4 px-3 py-2 rounded-lg" style={{ color: 'var(--color-text-light)', backgroundColor: 'var(--color-background)' }}>
          "{pedido.observacoes}"
        </p>
      )}

      {isPendente && (
        <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <button
            onClick={aceitar}
            disabled={aceitando}
            className="w-full text-sm font-medium py-2 px-4 rounded-lg text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--color-success)' }}
          >
            {aceitando
              ? <><RefreshCw size={14} className="animate-spin" /> Agendando...</>
              : <><CheckCircle size={14} /> Aceitar</>}
          </button>

          {!rejeitando ? (
            <button
              onClick={() => setRejeitando(true)}
              className="w-full text-sm font-medium py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              <XCircle size={14} /> Rejeitar
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo da rejeição (opcional)"
                className="w-full text-sm border rounded-lg p-2 resize-none"
                rows={2}
                style={{ borderColor: 'var(--color-border)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={rejeitar}
                  disabled={confirmandoRejeicao}
                  className="flex-1 text-sm font-medium py-1.5 rounded-lg text-white flex items-center justify-center gap-1"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  {confirmandoRejeicao ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={13} />}
                  Confirmar
                </button>
                <button
                  onClick={() => { setRejeitando(false); setMotivo(''); }}
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

      {pedido.status === 'confirmado' && (
        <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle size={13} /> Agendamento confirmado
          </p>
        </div>
      )}
      {pedido.status === 'cancelado' && pedido.observacoes && (
        <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-red-600">Motivo: {pedido.observacoes}</p>
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
      const res = await agendamentosAPI.getAll(params);
      setPedidos(res.data?.data || []);
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
