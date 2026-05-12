import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeiroAPI } from '../services/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceDot, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const today = new Date();

function DRERow({ label, value, indent = false, bold = false, separator = false, positive = true, big = false }) {
  return (
    <div className={`flex justify-between items-center py-2 ${separator ? 'border-t border-b border-gray-200 dark:border-gray-700 my-1' : ''} ${indent ? 'pl-6' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'} ${big ? 'text-base' : ''}`}>{label}</span>
      <span className={`text-sm font-semibold ${big ? 'text-base' : ''} ${bold ? 'font-bold' : ''} ${positive ? 'text-gray-800 dark:text-gray-100' : 'text-red-600'}`}>
        {value}
      </span>
    </div>
  );
}

function AbaDRE({ mes, ano, setMes, setAno }) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const { data, isLoading } = useQuery({
    queryKey: ['dre', mes, ano],
    queryFn: () => financeiroAPI.getDre({ mes, ano }).then(r => r.data.data),
  });

  // Histórico 6 meses para gráfico
  const { data: projecaoData } = useQuery({
    queryKey: ['projecao-dre'],
    queryFn: () => financeiroAPI.getProjecao().then(r => r.data.data),
  });

  const chart6 = projecaoData?.historico?.slice(-6) || [];

  if (isLoading) return <div className="text-center py-12 text-gray-400 dark:text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Filtro */}
      <div className="flex gap-3">
        <select className="border rounded-lg px-3 py-2 text-sm" value={mes} onChange={e => setMes(+e.target.value)}>
          {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={ano} onChange={e => setAno(+e.target.value)}>
          {[ano-1, ano, ano+1].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Extrato DRE */}
      <div className="bg-white dark:bg-gray-800 border rounded-xl shadow-sm p-6 max-w-xl">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-base">
          Demonstrativo de Resultado — {meses[mes-1]}/{ano}
        </h3>

        <DRERow label="(+) RECEITA BRUTA" value={fmt(data?.receitas?.total)} bold />
        {(data?.receitas?.detalhes || []).map(d => (
          <DRERow key={d.tipo} label={d.tipo === 'servico' ? 'Serviços' : d.tipo === 'produto' ? 'Produtos' : d.tipo}
            value={fmt(d.total)} indent />
        ))}

        <DRERow label="(-) COMISSÕES" value={`- ${fmt(data?.comissoes?.total)}`} positive={false} />

        <DRERow label="(=) LUCRO BRUTO" value={fmt(data?.lucroBruto)} bold separator
          positive={(data?.lucroBruto || 0) >= 0} />

        <DRERow label="(-) DESPESAS" value={`- ${fmt(data?.despesas?.total)}`} positive={false} />
        {(data?.despesas?.detalhes || []).map(d => (
          <DRERow key={d.categoria} label={d.categoria} value={`- ${fmt(d.total)}`} indent positive={false} />
        ))}

        <DRERow label="(=) LUCRO LÍQUIDO" value={fmt(data?.lucroLiquido)} bold separator big
          positive={(data?.lucroLiquido || 0) >= 0} />

        <div className="flex justify-between items-center pt-2 pl-6">
          <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Margem</span>
          <span className={`text-sm font-bold ${parseFloat(data?.margem || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data?.margem}%
          </span>
        </div>
      </div>

      {/* Gráfico receita vs despesa 6 meses */}
      {chart6.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Receita vs Despesa — últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart6} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="despesa" name="Despesa" fill="#f87171" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function AbaProjecao() {
  const { data, isLoading } = useQuery({
    queryKey: ['projecao'],
    queryFn: () => financeiroAPI.getProjecao().then(r => r.data.data),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400 dark:text-gray-500">Carregando...</div>;

  const historico = data?.historico || [];
  const chartData = [
    ...historico.map(h => ({ label: h.label, receita: h.receita })),
    { label: data?.projecaoLabel, projecao: data?.projecao }
  ];

  const tendenciaPositiva = (data?.tendencia || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">Média 3 meses</p>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{fmt(data?.mediaUltimos3)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${tendenciaPositiva ? 'bg-green-100' : 'bg-red-100'}`}>
              {tendenciaPositiva
                ? <TrendingUp className="w-5 h-5 text-green-600" />
                : <TrendingDown className="w-5 h-5 text-red-600" />}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">Tendência</p>
          </div>
          <p className={`text-2xl font-bold ${tendenciaPositiva ? 'text-green-600' : 'text-red-600'}`}>
            {tendenciaPositiva ? '+' : ''}{data?.tendencia}%
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg"><BarChart2 className="w-5 h-5 text-purple-600" /></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">Projeção próximo mês</p>
          </div>
          <p className="text-2xl font-bold text-purple-700">{fmt(data?.projecao)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{data?.projecaoLabel}</p>
        </div>
      </div>

      {/* Gráfico de linha */}
      <div className="bg-white dark:bg-gray-800 border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Histórico 12 meses + Projeção</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            <Line type="monotone" dataKey="receita" name="Receita" stroke="#3b82f6" strokeWidth={2}
              dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
            <Line type="monotone" dataKey="projecao" name="Projeção" stroke="#a855f7" strokeWidth={2}
              strokeDasharray="6 3" dot={{ r: 5, fill: '#a855f7' }} activeDot={{ r: 7 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Financeiro() {
  const navigate = useNavigate();
  const [aba, setAba] = useState('dre');
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());

  const abas = [
    { id: 'dre', label: 'DRE' },
    { id: 'despesas', label: 'Despesas' },
    { id: 'projecao', label: 'Projeção' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
        {abas.map(a => (
          <button key={a.id}
            onClick={() => a.id === 'despesas' ? navigate('/despesas') : setAba(a.id)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              aba === a.id
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
            }`}>
            {a.label}
            {a.id === 'despesas' && <Link className="inline w-3 h-3 ml-1 opacity-50" />}
          </button>
        ))}
      </div>

      {aba === 'dre' && <AbaDRE mes={mes} ano={ano} setMes={setMes} setAno={setAno} />}
      {aba === 'projecao' && <AbaProjecao />}
    </div>
  );
}
