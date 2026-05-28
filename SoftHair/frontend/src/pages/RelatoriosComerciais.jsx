import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { relatoriosAPI } from '../services/api';
import {
  BarChart3, DollarSign, Users, Package, TrendingUp, Scissors,
  CalendarRange, Loader2, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('pt-BR') : '-';
const fmtDay = (s) => s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

const PERIODOS = [
  { v: 'hoje', label: 'Hoje', dias: 1 },
  { v: 'semana', label: 'Últimos 7 dias', dias: 7 },
  { v: 'mes', label: 'Últimos 30 dias', dias: 30 },
  { v: 'trimestre', label: 'Últimos 90 dias', dias: 90 },
];

export default function RelatoriosComerciais() {
  const [periodo, setPeriodo] = useState('mes');
  const dias = PERIODOS.find((p) => p.v === periodo)?.dias || 30;

  const { data: fat } = useQuery({
    queryKey: ['rel-faturamento', periodo],
    queryFn: () => relatoriosAPI.faturamento(periodo),
  });
  const { data: serie } = useQuery({
    queryKey: ['rel-fatdiario', dias],
    queryFn: () => relatoriosAPI.faturamentoDiario(dias),
  });
  const { data: rank } = useQuery({
    queryKey: ['rel-rankprof', dias],
    queryFn: () => relatoriosAPI.rankingProfissionais(dias),
  });
  const { data: top } = useQuery({
    queryKey: ['rel-topcli', dias],
    queryFn: () => relatoriosAPI.topClientes(dias),
  });
  const { data: prod } = useQuery({
    queryKey: ['rel-prod', dias],
    queryFn: () => relatoriosAPI.produtosVendidos(dias),
  });
  const { data: svc } = useQuery({
    queryKey: ['rel-svc', dias],
    queryFn: () => relatoriosAPI.servicosMaisVendidos(dias),
  });
  const { data: com } = useQuery({
    queryKey: ['rel-com'],
    queryFn: () => relatoriosAPI.comissoesPagar(),
  });

  const f = fat?.data?.data || {};
  const serieData = (serie?.data?.data || []).map((d) => ({ ...d, dia: fmtDay(d.dia), total: Number(d.total) }));
  const ranks = rank?.data?.data || [];
  const tops = top?.data?.data || [];
  const prods = prod?.data?.data || [];
  const svcs = svc?.data?.data || [];
  const coms = com?.data?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Relatórios comerciais</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Faturamento, ranking, top clientes, produtos e comissões.</p>
          </div>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl font-medium"
        >
          {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Faturamento" value={fmtMoney(f.total_faturado)} accent="emerald" />
        <StatCard icon={TrendingUp} label="Ticket médio" value={fmtMoney(f.ticket_medio)} accent="indigo" />
        <StatCard icon={CalendarRange} label="Vendas" value={f.qtd_vendas || 0} accent="amber" />
        <StatCard icon={Users} label="Clientes únicos" value={f.clientes_unicos || 0} accent="rose" />
      </div>

      <Section title="Faturamento diário">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={serieData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Ranking de profissionais" icon={Scissors}>
          <RankList
            items={ranks.map((r) => ({
              id: r.id,
              nome: r.nome,
              extra: `${r.qtd_atendimentos || 0} atend.`,
              valor: fmtMoney(Number(r.total_atendimentos || 0) + Number(r.total_vendas || 0)),
            }))}
          />
        </Section>

        <Section title="Top clientes" icon={Users}>
          <RankList
            items={tops.map((c) => ({
              id: c.id,
              nome: c.nome,
              extra: `${c.qtd_vendas || 0} compras · última ${fmtDate(c.ultima_compra)}`,
              valor: fmtMoney(c.total_gasto),
            }))}
          />
        </Section>

        <Section title="Produtos mais vendidos" icon={Package}>
          <RankList
            items={prods.map((p) => ({
              id: p.id,
              nome: p.nome,
              extra: `${p.qtd || 0} un · ${p.categoria || ''}`,
              valor: fmtMoney(p.faturado),
            }))}
          />
        </Section>

        <Section title="Serviços mais vendidos" icon={Scissors}>
          <RankList
            items={svcs.map((s) => ({
              id: s.id ?? s.nome,
              nome: s.nome,
              extra: `${s.total || 0}x`,
              valor: fmtMoney(s.receita),
            }))}
          />
        </Section>
      </div>

      <Section title="Comissões a pagar" icon={DollarSign} accent="rose">
        {coms.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sem pendências.</p>
        ) : (
          <div className="space-y-2">
            {coms.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{c.nome}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.qtd} comissões pendentes</p>
                </div>
                <span className="font-bold text-rose-700">{fmtMoney(c.total_pendente)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
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

function Section({ title, icon: Icon, accent = 'indigo', children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={18} className="text-gray-500 dark:text-gray-400" />}
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function RankList({ items }) {
  if (!items.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">Sem dados no período.</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.slice(0, 10).map((it, i) => (
        <div key={it.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{it.nome}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{it.extra}</p>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{it.valor}</span>
        </div>
      ))}
    </div>
  );
}
