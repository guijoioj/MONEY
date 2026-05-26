import { useQuery } from '@tanstack/react-query';
import { comissoesAPI } from '../services/api';
import { DollarSign, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Tela do PROFISSIONAL — vê apenas suas próprias comissões (backend filtra
 * automaticamente via profissional_id do JWT).
 */
export default function MinhasComissoes() {
  const { user } = useAuth();

  const { data: pagasResp, isLoading: lp } = useQuery({
    queryKey: ['minhas-comissoes-pagas'],
    queryFn: () => comissoesAPI.getPagas(),
  });
  const { data: estornosResp, isLoading: le } = useQuery({
    queryKey: ['minhas-comissoes-estornos'],
    queryFn: () => comissoesAPI.getEstornos(),
  });

  const pagas = pagasResp?.data?.data || [];
  const estornos = estornosResp?.data?.data || [];

  const totalPago = pagas.reduce((s, c) => s + Number(c.valor || c.valor_total || 0), 0);
  const totalEstornado = estornos.reduce((s, c) => s + Number(c.valor || c.valor_total || 0), 0);

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
          <DollarSign size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Minhas comissões</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user?.nome ? `Olá, ${user.nome}. ` : ''}Histórico das suas comissões pagas e estornadas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard icon={CheckCircle2} label="Total recebido" value={fmt(totalPago)} accent="emerald" />
        <SummaryCard icon={AlertCircle}  label="Total estornado" value={fmt(totalEstornado)} accent="rose" />
      </div>

      <Section title="Comissões pagas" loading={lp} empty={pagas.length === 0} emptyMsg="Nenhuma comissão paga ainda.">
        <div className="space-y-2">
          {pagas.map((c) => (
            <Row
              key={c.id}
              left={c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-'}
              middle={c.observacoes || c.descricao || `Comissão #${c.id}`}
              right={fmt(c.valor || c.valor_total)}
              icon={CheckCircle2}
              accent="emerald"
            />
          ))}
        </div>
      </Section>

      <Section title="Estornos" loading={le} empty={estornos.length === 0} emptyMsg="Nenhum estorno registrado.">
        <div className="space-y-2">
          {estornos.map((c) => (
            <Row
              key={c.id}
              left={c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-'}
              middle={c.motivo || c.observacoes || `Estorno #${c.id}`}
              right={`- ${fmt(c.valor || c.valor_total)}`}
              icon={AlertCircle}
              accent="rose"
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }) {
  const accentMap = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accentMap[accent]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, loading, empty, emptyMsg, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} /> Carregando…
        </div>
      ) : empty ? (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-4">
          <Clock size={16} /> {emptyMsg}
        </div>
      ) : children}
    </div>
  );
}

function Row({ left, middle, right, icon: Icon, accent }) {
  const colorMap = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={`shrink-0 ${colorMap[accent]}`} size={18} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{middle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{left}</p>
        </div>
      </div>
      <span className={`font-semibold ${colorMap[accent]}`}>{right}</span>
    </div>
  );
}
