import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { comissoesV2API, profissionaisAPI } from '../services/api';

function formatBRL(cents) {
  if (cents == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(cents) / 100);
}

function toCents(reais) {
  const clean = String(reais).replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(clean) * 100);
}

export default function PagamentoComissao() {
  const navigate = useNavigate();
  const [profissionalId, setProfissionalId] = useState('');
  const [periodo, setPeriodo] = useState({
    data_inicio: new Date().toISOString().slice(0, 8) + '01',
    data_fim: new Date().toISOString().slice(0, 10),
  });
  const [valorConfirmado, setValorConfirmado] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [observacao, setObservacao] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Profissionais
  const { data: profs } = useQuery({
    queryKey: ['profissionais-all'],
    queryFn: () => profissionaisAPI.getAll().then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
    }),
  });

  // Comissões pendentes do prof no período
  const { data: comissoes, refetch: refetchComissoes } = useQuery({
    queryKey: ['comissoes-pendentes', profissionalId, periodo],
    queryFn: async () => {
      if (!profissionalId) return [];
      const r = await comissoesV2API.list({
        profissional_id: profissionalId,
        status: 'pendente',
        data_inicio: periodo.data_inicio,
        data_fim: periodo.data_fim,
        limit: 500,
      });
      return r.data?.data || [];
    },
    enabled: !!profissionalId,
  });

  const totalSelecionadoCents = (comissoes || [])
    .filter(c => selectedIds.has(c.id))
    .reduce((s, c) => s + Number(c.valor_comissao_cents || 0), 0);

  const valorConfirmadoCents = valorConfirmado ? toCents(valorConfirmado) : null;
  const divergente = valorConfirmadoCents != null
    && Math.abs(valorConfirmadoCents - totalSelecionadoCents) > 1;

  const pagar = useMutation({
    mutationFn: (data) => comissoesV2API.pagar(data),
    onSuccess: (r) => {
      alert(`Pagamento criado! Valor: ${formatBRL(r.data?.data?.valor_total_cents)}`);
      navigate('/comissoes-v2');
    },
    onError: (e) => alert(`Erro: ${e?.response?.data?.error || e.message}`),
  });

  const toggleAll = () => {
    if (selectedIds.size === comissoes?.length) setSelectedIds(new Set());
    else setSelectedIds(new Set((comissoes || []).map(c => c.id)));
  };

  const handlePagar = () => {
    if (selectedIds.size === 0) { alert('Selecione pelo menos 1 comissão'); return; }
    if (divergente) { alert('Valor confirmado divergente do total. Confira.'); return; }
    pagar.mutate({
      profissional_id: profissionalId,
      data_inicio: periodo.data_inicio,
      data_fim: periodo.data_fim,
      comissoes_ids: Array.from(selectedIds),
      valor_confirmado_cents: valorConfirmadoCents || totalSelecionadoCents,
      forma_pagamento: formaPagamento,
      observacao,
      idempotency_key: `pag-${profissionalId}-${periodo.data_inicio}-${Date.now()}`,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pagamento de Comissões</h1>

      {/* Wizard step 1: prof + período */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">1. Selecione profissional e período</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Profissional</label>
            <select
              value={profissionalId}
              onChange={e => { setProfissionalId(e.target.value); setSelectedIds(new Set()); }}
              className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
            >
              <option value="">Selecione...</option>
              {(profs || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input type="date" value={periodo.data_inicio}
              onChange={e => setPeriodo(p => ({ ...p, data_inicio: e.target.value }))}
              className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input type="date" value={periodo.data_fim}
              onChange={e => setPeriodo(p => ({ ...p, data_fim: e.target.value }))}
              className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600" />
          </div>
        </div>
      </div>

      {/* Step 2: lista de comissões */}
      {profissionalId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              2. Selecione comissões ({comissoes?.length || 0} pendentes)
            </h2>
            <button onClick={toggleAll} className="text-xs text-indigo-600 hover:underline">
              {selectedIds.size === comissoes?.length ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-1.5 w-8"></th>
                  <th className="px-3 py-1.5 text-left text-xs">Data</th>
                  <th className="px-3 py-1.5 text-left text-xs">Cliente</th>
                  <th className="px-3 py-1.5 text-left text-xs">Item</th>
                  <th className="px-3 py-1.5 text-right text-xs">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {!comissoes?.length ? (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-500">Nenhuma pendente neste período</td></tr>
                ) : (
                  comissoes.map(c => (
                    <tr key={c.id} className={selectedIds.has(c.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => {
                            const next = new Set(selectedIds);
                            if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-1.5">{c.data_geracao ? new Date(c.data_geracao).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-3 py-1.5">{c.cliente_nome || '—'}</td>
                      <td className="px-3 py-1.5">{c.servico_nome || c.produto_nome || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatBRL(c.valor_comissao_cents)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t dark:border-gray-700 flex justify-between items-center">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedIds.size} selecionada(s)
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Total: {formatBRL(totalSelecionadoCents)}
            </span>
          </div>
        </div>
      )}

      {/* Step 3: confirmação */}
      {profissionalId && selectedIds.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">3. Confirmar pagamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor confirmado (R$)</label>
              <input
                type="text"
                value={valorConfirmado}
                onChange={e => setValorConfirmado(e.target.value)}
                placeholder={formatBRL(totalSelecionadoCents)}
                className={`w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600 ${divergente ? 'border-red-500' : ''}`}
              />
              {divergente && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Divergente do total calculado!
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              >
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Observação</label>
            <input
              type="text"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              placeholder="Ex: comissão de janeiro"
            />
          </div>
          <button
            onClick={handlePagar}
            disabled={pagar.isPending || divergente}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {pagar.isPending ? 'Processando...' : `Confirmar Pagamento de ${formatBRL(valorConfirmadoCents || totalSelecionadoCents)}`}
          </button>
        </div>
      )}
    </div>
  );
}
