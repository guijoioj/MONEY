import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS = Array.from({ length: 24 }, (_, i) => i);

const TABS = [
  { id: 'servicos', label: 'Serviços Mais Vendidos' },
  { id: 'pico', label: 'Horários de Pico' },
  { id: 'cancelamentos', label: 'Cancelamentos' },
  { id: 'inativos', label: 'Clientes Inativos' },
  { id: 'mensal', label: 'Comparativo Mensal' },
  { id: 'ticket', label: 'Ticket Médio' },
];

function fmt(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function fmtNum(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function PeriodSelect({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ message = 'Nenhum dado encontrado para o período selecionado.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" className="mb-3 opacity-30">
        <path d="M9 17H15M9 13H15M9 9H10M13 3H5C4.44772 3 4 3.44772 4 4V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V10L13 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Aba: Serviços Mais Vendidos ──────────────────────────────────────────────
function TabServicos() {
  const [dias, setDias] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', 'servicos', dias],
    queryFn: () => api.get('/relatorios/servicos-mais-vendidos', { params: { dias } }).then(r => r.data.data || []),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Serviços Mais Vendidos</h2>
        <PeriodSelect
          label="Período"
          value={dias}
          onChange={setDias}
          options={[
            { value: 7, label: 'Últimos 7 dias' },
            { value: 30, label: 'Últimos 30 dias' },
            { value: 60, label: 'Últimos 60 dias' },
            { value: 90, label: 'Últimos 90 dias' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : !data?.length ? <EmptyState /> : (
        <>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => n === 'receita' ? fmt(v) : fmtNum(v)} />
                <Legend />
                <Bar dataKey="total" name="Qtd. Atendimentos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="receita" name="Receita (R$)" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Serviço</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Atendimentos</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Receita Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((row, i) => (
                  <tr key={row.nome} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.nome}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmtNum(row.total)}</td>
                    <td className="px-5 py-3 text-right font-medium text-indigo-600">{fmt(row.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Aba: Horários de Pico ────────────────────────────────────────────────────
function TabPico() {
  const [semanas, setSemanas] = useState(4);
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', 'pico', semanas],
    queryFn: () => api.get('/relatorios/horarios-pico', { params: { semanas } }).then(r => r.data.data || []),
  });

  // Build 7x24 grid
  const grid = {};
  let maxVal = 0;
  (data || []).forEach(row => {
    const key = `${row.diaSemana}-${row.hora}`;
    const val = parseInt(row.total || 0);
    grid[key] = val;
    if (val > maxVal) maxVal = val;
  });

  function intensity(val) {
    if (!maxVal || !val) return 'bg-gray-100';
    const ratio = val / maxVal;
    if (ratio >= 0.8) return 'bg-indigo-600 text-white';
    if (ratio >= 0.6) return 'bg-indigo-400 text-white';
    if (ratio >= 0.4) return 'bg-indigo-300 text-white';
    if (ratio >= 0.2) return 'bg-indigo-200 text-indigo-800';
    return 'bg-indigo-100 text-indigo-700';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Horários de Pico</h2>
        <PeriodSelect
          label="Período"
          value={semanas}
          onChange={setSemanas}
          options={[
            { value: 2, label: 'Últimas 2 semanas' },
            { value: 4, label: 'Últimas 4 semanas' },
            { value: 8, label: 'Últimas 8 semanas' },
            { value: 12, label: 'Últimas 12 semanas' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : !data?.length ? <EmptyState /> : (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm overflow-x-auto">
          <p className="text-xs text-gray-400 mb-4">Intensidade de agendamentos por dia da semana e hora do dia</p>
          <div className="min-w-[640px]">
            {/* Header: horas */}
            <div className="flex">
              <div className="w-12 flex-shrink-0" />
              {HORAS.map(h => (
                <div key={h} className="flex-1 text-center text-[10px] text-gray-400 font-mono pb-1">
                  {h}h
                </div>
              ))}
            </div>
            {/* Rows: dias da semana */}
            {DIAS_SEMANA.map((dia, dIdx) => (
              <div key={dia} className="flex items-center mb-1">
                <div className="w-12 flex-shrink-0 text-xs font-medium text-gray-500 pr-2 text-right">{dia}</div>
                {HORAS.map(h => {
                  const val = grid[`${dIdx}-${h}`] || 0;
                  return (
                    <div
                      key={h}
                      title={`${dia} ${h}:00 — ${val} agendamento${val !== 1 ? 's' : ''}`}
                      className={`flex-1 h-7 mx-px rounded flex items-center justify-center text-[9px] font-bold transition-all ${intensity(val)}`}
                    >
                      {val > 0 ? val : ''}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 justify-end flex-wrap">
              <span className="text-[10px] text-gray-400">Baixo</span>
              {['bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300', 'bg-indigo-400', 'bg-indigo-600'].map(c => (
                <div key={c} className={`w-5 h-3 rounded ${c}`} />
              ))}
              <span className="text-[10px] text-gray-400">Alto</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba: Cancelamentos ───────────────────────────────────────────────────────
function TabCancelamentos() {
  const [dias, setDias] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', 'cancelamentos', dias],
    queryFn: () => api.get('/relatorios/cancelamentos', { params: { dias } }).then(r => r.data.data || []),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Cancelamentos por Profissional</h2>
        <PeriodSelect
          label="Período"
          value={dias}
          onChange={setDias}
          options={[
            { value: 7, label: 'Últimos 7 dias' },
            { value: 30, label: 'Últimos 30 dias' },
            { value: 60, label: 'Últimos 60 dias' },
            { value: 90, label: 'Últimos 90 dias' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : !data?.length ? <EmptyState /> : (
        <>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="profissional" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cancelados" name="Cancelados" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Profissional</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Cancelados</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(row => {
                  const taxa = parseFloat(row.taxa || 0);
                  return (
                    <tr key={row.profissional} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800">{row.profissional}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmtNum(row.total)}</td>
                      <td className="px-5 py-3 text-right text-red-600 font-medium">{fmtNum(row.cancelados)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${taxa >= 30 ? 'bg-red-100 text-red-700' : taxa >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          {taxa}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Aba: Clientes Inativos ───────────────────────────────────────────────────
function TabInativos() {
  const [dias, setDias] = useState(60);
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', 'inativos', dias],
    queryFn: () => api.get('/relatorios/clientes-inativos', { params: { dias } }).then(r => r.data.data || []),
  });

  function exportarMailto() {
    if (!data?.length) return;
    const lista = data
      .filter(c => c.email)
      .map(c => c.email)
      .join(', ');
    const assunto = encodeURIComponent(`Sentimos sua falta! Volte ao salão`);
    const corpo = encodeURIComponent(
      `Olá! Notamos que faz um tempo que você não nos visita. Que tal agendar um horário? Clique no link para ver nossas disponibilidades.`
    );
    window.open(`mailto:${lista}?subject=${assunto}&body=${corpo}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Clientes Inativos</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodSelect
            label="Sem visita há"
            value={dias}
            onChange={setDias}
            options={[
              { value: 30, label: '30+ dias' },
              { value: 60, label: '60+ dias' },
              { value: 90, label: '90+ dias' },
              { value: 180, label: '180+ dias' },
            ]}
          />
          <button
            onClick={exportarMailto}
            disabled={!data?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Exportar E-mail
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : !data?.length ? <EmptyState /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="text-amber-500"><path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs text-amber-700 font-medium">{data.length} clientes sem visita há {dias}+ dias</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Telefone</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">E-mail</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Última Visita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{row.nome}</td>
                  <td className="px-5 py-3 text-gray-600">{row.telefone || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {row.email ? (
                      <a href={`mailto:${row.email}`} className="text-indigo-600 hover:underline">{row.email}</a>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    {row.ultimoAgendamento ? fmtDate(row.ultimoAgendamento) : <span className="text-red-400 text-xs">Nunca agendou</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Aba: Comparativo Mensal ──────────────────────────────────────────────────
function TabMensal() {
  const [meses, setMeses] = useState(6);
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', 'mensal', meses],
    queryFn: () => api.get('/relatorios/comparativo-mensal', { params: { meses } }).then(r => r.data.data || []),
  });

  const chartData = (data || []).map(row => ({
    mes: row.mes,
    Total: parseInt(row.totalAgendamentos || 0),
    Confirmados: parseInt(row.confirmados || 0),
    Cancelados: parseInt(row.cancelados || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Comparativo Mensal de Agendamentos</h2>
        <PeriodSelect
          label="Período"
          value={meses}
          onChange={setMeses}
          options={[
            { value: 3, label: 'Últimos 3 meses' },
            { value: 6, label: 'Últimos 6 meses' },
            { value: 12, label: 'Últimos 12 meses' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : !data?.length ? <EmptyState /> : (
        <>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Confirmados" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Cancelados" stroke="#f87171" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Mês</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Confirmados</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Cancelados</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Taxa Cancela.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(row => {
                  const total = parseInt(row.totalAgendamentos || 0);
                  const cancelados = parseInt(row.cancelados || 0);
                  const taxa = total > 0 ? ((cancelados / total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={row.mes} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800">{row.mes}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmtNum(total)}</td>
                      <td className="px-5 py-3 text-right text-green-600 font-medium">{fmtNum(row.confirmados)}</td>
                      <td className="px-5 py-3 text-right text-red-500">{fmtNum(cancelados)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-semibold ${parseFloat(taxa) >= 20 ? 'text-red-600' : 'text-gray-500'}`}>{taxa}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Aba: Ticket Médio ────────────────────────────────────────────────────────
function TabTicket() {
  const [dias, setDias] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', 'ticket', dias],
    queryFn: () => api.get('/relatorios/ticket-medio', { params: { dias } }).then(r => r.data.data || []),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Ticket Médio por Cliente</h2>
        <PeriodSelect
          label="Período"
          value={dias}
          onChange={setDias}
          options={[
            { value: 7, label: 'Últimos 7 dias' },
            { value: 30, label: 'Últimos 30 dias' },
            { value: 60, label: 'Últimos 60 dias' },
            { value: 90, label: 'Últimos 90 dias' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : !data?.length ? <EmptyState /> : (
        <>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.slice(0, 10)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Bar dataKey="ticketMedio" name="Ticket Médio" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalGasto" name="Total Gasto" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Telefone</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Visitas</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Total Gasto</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Ticket Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((row, i) => (
                  <tr key={row.nome + i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.nome}</td>
                    <td className="px-5 py-3 text-gray-600">{row.telefone || '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmtNum(row.visitas)}</td>
                    <td className="px-5 py-3 text-right font-medium text-indigo-600">{fmt(row.totalGasto)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-indigo-700">{fmt(row.ticketMedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Relatorios() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'servicos';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams({ tab: id });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-1">Análises detalhadas sobre o desempenho do salão</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'servicos' && <TabServicos />}
        {activeTab === 'pico' && <TabPico />}
        {activeTab === 'cancelamentos' && <TabCancelamentos />}
        {activeTab === 'inativos' && <TabInativos />}
        {activeTab === 'mensal' && <TabMensal />}
        {activeTab === 'ticket' && <TabTicket />}
      </div>
    </div>
  );
}
