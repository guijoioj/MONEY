import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign, AlertCircle, CheckCircle, XCircle, FileText, RefreshCw, Download, Filter } from 'lucide-react';
import { comissoesV2API } from '../services/api';

function formatBRL(cents) {
  if (cents == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(cents) / 100);
}

function StatusBadge({ status }) {
  const map = {
    pendente:  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Pendente' },
    paga:      { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Paga' },
    estornada: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Estornada' },
    cancelada: { bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Cancelada' },
    bloqueada: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Bloqueada' },
  };
  const s = map[status] || map.pendente;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color, link }) {
  const body = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6" style={{ color }} />
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}

export default function ComissoesV2() {
  const [filtros, setFiltros] = useState({
    status: '',
    profissional_id: '',
    competencia: new Date().toISOString().slice(0, 7),
  });

  // Dashboard agregado
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['comissoes-v2-dashboard', filtros.competencia],
    queryFn: () => comissoesV2API.dashboard({ competencia: filtros.competencia }).then(r => r.data?.data),
    retry: 1,
  });

  // Lista de comissões
  const { data: listData, isLoading: listLoading, refetch } = useQuery({
    queryKey: ['comissoes-v2-list', filtros],
    queryFn: () => {
      const params = { limit: 100 };
      if (filtros.status) params.status = filtros.status;
      if (filtros.profissional_id) params.profissional_id = filtros.profissional_id;
      if (filtros.competencia) params.competencia = filtros.competencia;
      return comissoesV2API.list(params).then(r => r.data?.data || []);
    },
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const exportCSV = () => {
    if (!listData || listData.length === 0) return;
    const headers = ['ID', 'Profissional', 'Cliente', 'Serviço/Produto', 'Base', 'Comissão', 'Status', 'Data'];
    const rows = listData.map(c => [
      c.id,
      c.profissional_nome || '',
      c.cliente_nome || '',
      c.servico_nome || c.produto_nome || '',
      formatBRL(c.valor_base_cents || 0),
      formatBRL(c.valor_comissao_cents || 0),
      c.status,
      c.data_geracao ? new Date(c.data_geracao).toLocaleString('pt-BR') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes_${filtros.competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Comissões V2</h1>
        <div className="flex gap-2">
          <Link to="/comissoes/regras" className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Regras
          </Link>
          <Link to="/comissoes/pagamento" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pagar Lote
          </Link>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={AlertCircle} label="Pendente" value={formatBRL(dashData?.total_pendente_cents)} color="#f59e0b" />
        <StatCard icon={CheckCircle} label="Pago" value={formatBRL(dashData?.total_pago_cents)} color="#10b981" />
        <StatCard icon={XCircle} label="Estornado" value={formatBRL(dashData?.total_estornado_cents)} color="#ef4444" />
        <StatCard icon={DollarSign} label="Ajustes" value={formatBRL(dashData?.total_ajustes_cents)} color="#6366f1" />
      </div>

      {/* Top profissionais */}
      {dashData?.ranking_profissionais?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Profissionais</h3>
          <div className="space-y-2">
            {dashData.ranking_profissionais.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <Link to={`/comissoes/extrato/${p.id}`} className="hover:underline text-gray-900 dark:text-gray-100">
                    {p.nome}
                  </Link>
                </div>
                <span className="font-mono text-gray-700 dark:text-gray-300">{formatBRL(p.total_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={filtros.status}
            onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="paga">Paga</option>
            <option value="estornada">Estornada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Competência</label>
          <input
            type="month"
            value={filtros.competencia}
            onChange={e => setFiltros(f => ({ ...f, competencia: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
        <button
          onClick={exportCSV}
          disabled={!listData?.length}
          className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Profissional</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Base</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">%</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Comissão</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {listLoading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Carregando...</td></tr>
              ) : !listData?.length ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Nenhuma comissão encontrada</td></tr>
              ) : (
                listData.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {c.data_geracao ? new Date(c.data_geracao).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{c.profissional_nome || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{c.cliente_nome || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {c.servico_nome || c.produto_nome || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatBRL(c.valor_base_cents)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">
                      {c.percentual != null ? `${Number(c.percentual).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {formatBRL(c.valor_comissao_cents)}
                    </td>
                    <td className="px-4 py-2 text-center"><StatusBadge status={c.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
