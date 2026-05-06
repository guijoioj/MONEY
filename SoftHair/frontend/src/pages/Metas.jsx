import { useState, useEffect, useCallback } from 'react';
import { Target, RefreshCw, X } from 'lucide-react';
import api from '../services/api';

const formatCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function ProgressBar({ percent, color }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      ></div>
    </div>
  );
}

function getColor(percent) {
  if (percent >= 80) return 'bg-green-500';
  if (percent >= 50) return 'bg-yellow-400';
  return 'bg-red-500';
}

export default function Metas() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [progresso, setProgresso] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // profissional sendo editado
  const [metaValor, setMetaValor] = useState('');
  const [metaAtend, setMetaAtend] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/metas/progresso', { params: { mes, ano } });
      setProgresso(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => { load(); }, [load]);

  const openModal = (prof) => {
    setModal(prof);
    setMetaValor(prof.metaValor || '');
    setMetaAtend(prof.metaAtendimentos || '');
    setErro('');
  };

  const saveMeta = async () => {
    setSaving(true);
    setErro('');
    try {
      await api.post('/metas', {
        profissional_id: modal.id,
        mes,
        ano,
        meta_valor: parseFloat(metaValor) || 0,
        meta_atendimentos: parseInt(metaAtend) || 0,
      });
      setModal(null);
      await load();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar meta.');
    } finally {
      setSaving(false);
    }
  };

  const meses = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Metas por Profissional</h1>
        <div className="flex items-center gap-3">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : progresso.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Target size={48} className="mb-3 opacity-50" />
          <p>Nenhum profissional ativo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {progresso.map((prof) => {
            const pctValor = prof.metaValor > 0 ? (prof.realizadoValor / prof.metaValor) * 100 : 0;
            const pctAtend = prof.metaAtendimentos > 0 ? (prof.realizadoAtendimentos / prof.metaAtendimentos) * 100 : 0;
            return (
              <div key={prof.id} className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {prof.foto ? (
                      <img src={prof.foto} alt={prof.nome} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                        {prof.nome.charAt(0)}
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-800">{prof.nome}</h3>
                  </div>
                  <button
                    onClick={() => openModal(prof)}
                    className="text-xs px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                  >
                    Editar Meta
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Receita</span>
                      <span className="font-medium">
                        {formatCurrency(prof.realizadoValor)} / {formatCurrency(prof.metaValor)}
                      </span>
                    </div>
                    <ProgressBar percent={pctValor} color={getColor(pctValor)} />
                    <p className="text-xs text-right text-gray-500 mt-1">{pctValor.toFixed(0)}%</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Atendimentos</span>
                      <span className="font-medium">
                        {prof.realizadoAtendimentos} / {prof.metaAtendimentos}
                      </span>
                    </div>
                    <ProgressBar percent={pctAtend} color={getColor(pctAtend)} />
                    <p className="text-xs text-right text-gray-500 mt-1">{pctAtend.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Meta — {modal.nome}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            {erro && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded p-2">{erro}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta de Receita (R$)</label>
                <input
                  type="number"
                  value={metaValor}
                  onChange={e => setMetaValor(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta de Atendimentos</label>
                <input
                  type="number"
                  value={metaAtend}
                  onChange={e => setMetaAtend(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={saveMeta} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-50">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
