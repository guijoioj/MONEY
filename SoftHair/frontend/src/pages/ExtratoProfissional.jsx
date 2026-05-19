import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { comissoesV2API } from '../services/api';

function formatBRL(cents) {
  if (cents == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(cents) / 100);
}

export default function ExtratoProfissional() {
  const { id } = useParams();
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));

  const { data, isLoading, error } = useQuery({
    queryKey: ['extrato', id, competencia],
    queryFn: () => comissoesV2API.extrato(id, { competencia }).then(r => r.data?.data),
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) return <div className="text-center py-8 text-gray-500">Carregando holerite...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Erro: {error.message}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Extrato — {data.profissional?.nome}</h1>
        <div className="flex gap-2">
          <input
            type="month"
            value={competencia}
            onChange={e => setCompetencia(e.target.value)}
            className="px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600 text-sm"
          />
          <button onClick={() => window.print()} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Holerite */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 print:shadow-none print:rounded-none">
        <div className="border-b dark:border-gray-700 pb-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Demonstrativo de Comissões</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Profissional: <strong className="text-gray-800 dark:text-gray-200">{data.profissional?.nome}</strong>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Competência: <strong>{competencia}</strong>
          </p>
        </div>

        {/* Totalizadores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pendente</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatBRL(data.total_pendente_cents)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pago</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatBRL(data.total_pago_cents)}</p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Ajustes</p>
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{formatBRL(data.total_ajustes_pendentes_cents)}</p>
          </div>
          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded border-2 border-blue-300 dark:border-blue-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">A Receber</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatBRL(data.liquido_a_pagar_cents)}</p>
          </div>
        </div>

        {/* Comissões detalhadas */}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Atendimentos / Vendas</h3>
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Comissão</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {!data.comissoes?.length ? (
                <tr><td colSpan={7} className="text-center py-6 text-gray-500">Nenhuma comissão neste período</td></tr>
              ) : (
                data.comissoes.map(c => (
                  <tr key={c.id}>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                      {c.data_geracao ? new Date(c.data_geracao).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{c.cliente_nome || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{c.servico_nome || c.produto_nome || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-700 dark:text-gray-300">{formatBRL(c.valor_base_cents)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">
                      {c.percentual != null ? `${Number(c.percentual).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">{formatBRL(c.valor_comissao_cents)}</td>
                    <td className="px-3 py-1.5 text-center text-xs">{c.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Ajustes */}
        {data.ajustes?.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ajustes</h3>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.ajustes.map(a => (
                    <tr key={a.id}>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{a.tipo}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{a.motivo}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${Number(a.valor_cents) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatBRL(a.valor_cents)}
                      </td>
                      <td className="px-3 py-1.5 text-center text-xs">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Histórico de pagamentos */}
        {data.pagamentos?.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Histórico de Pagamentos</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Forma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.pagamentos.map(p => (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{p.periodo_inicio} → {p.periodo_fim}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatBRL(p.valor_total_cents)}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{p.forma_pagamento || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
