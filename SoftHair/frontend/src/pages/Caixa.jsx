import { useState, useEffect, useCallback } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import api from '../services/api';

const formatCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatDatetime = (s) => {
  if (!s) return '-';
  return new Date(s).toLocaleString('pt-BR');
};

export default function Caixa() {
  const [status, setStatus] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saldoInicial, setSaldoInicial] = useState('');
  const [obs, setObs] = useState('');
  const [saldoFinal, setSaldoFinal] = useState('');
  const [obsFecha, setObsFecha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [hojeRes, histRes] = await Promise.all([
        api.get('/caixa/hoje'),
        api.get('/caixa'),
      ]);
      setStatus(hojeRes.data?.data || null);
      setHistorico(Array.isArray(histRes.data?.data) ? histRes.data.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const abrir = async () => {
    setErro('');
    setSubmitting(true);
    try {
      await api.post('/caixa/abrir', { saldo_inicial: parseFloat(saldoInicial) || 0, observacoes: obs });
      setSaldoInicial('');
      setObs('');
      await load();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao abrir caixa.');
    } finally {
      setSubmitting(false);
    }
  };

  const fechar = async () => {
    setErro('');
    setSubmitting(true);
    try {
      await api.put(`/caixa/${status.caixa.id}/fechar`, { saldo_final: parseFloat(saldoFinal) || 0, observacoes: obsFecha });
      setSaldoFinal('');
      setObsFecha('');
      await load();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao fechar caixa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  const aberto = status?.caixa && !status.caixa.fechadoEm;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Controle de Caixa</h1>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{erro}</div>}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-4 h-4 rounded-full ${aberto ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <h2 className="text-lg font-semibold text-gray-800">
            Status: {aberto ? 'Aberto 🟢' : 'Fechado 🔴'}
          </h2>
        </div>

        {aberto ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Saldo Inicial</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(status.caixa.saldoInicial)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Vendas</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(status.totalVendas)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Despesas</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(status.totalDespesas)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Saldo Estimado</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(status.saldoEstimado)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">Aberto em: {formatDatetime(status.caixa.abertoEm)}</p>
            <div className="border-t pt-4 mt-4 space-y-3">
              <h3 className="font-medium text-gray-700">Fechar Caixa</h3>
              <div className="flex gap-3 flex-wrap">
                <input
                  type="number"
                  placeholder="Saldo final (R$)"
                  value={saldoFinal}
                  onChange={e => setSaldoFinal(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-48"
                />
                <input
                  type="text"
                  placeholder="Observações (opcional)"
                  value={obsFecha}
                  onChange={e => setObsFecha(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
                />
                <button
                  onClick={fechar}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Fechar Caixa
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700">Abrir Caixa</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                type="number"
                placeholder="Saldo inicial (R$)"
                value={saldoInicial}
                onChange={e => setSaldoInicial(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-48"
              />
              <input
                type="text"
                placeholder="Observações (opcional)"
                value={obs}
                onChange={e => setObs(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
              />
              <button
                onClick={abrir}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Abrir Caixa
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Histórico — Últimos 30 dias</h2>
        {historico.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Data Abertura</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Data Fechamento</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Saldo Inicial</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Saldo Final</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{formatDatetime(c.abertoEm)}</td>
                    <td className="py-3 px-4">{c.fechadoEm ? formatDatetime(c.fechadoEm) : '-'}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(c.saldoInicial)}</td>
                    <td className="py-3 px-4 text-right">{c.saldoFinal != null ? formatCurrency(c.saldoFinal) : '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.fechadoEm ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                        {c.fechadoEm ? 'Fechado' : 'Aberto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <DollarSign size={48} className="mb-3 opacity-50" />
            <p>Nenhum registro de caixa nos últimos 30 dias.</p>
          </div>
        )}
      </div>
    </div>
  );
}
