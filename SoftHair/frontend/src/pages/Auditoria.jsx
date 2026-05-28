import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogAPI } from '../services/api';
import {
  Shield, Search, ChevronLeft, ChevronRight, X, Loader2, AlertCircle,
  User, Clock,
} from 'lucide-react';

const fmtDate = (s) => s ? new Date(s).toLocaleString('pt-BR') : '-';

const ACTOR_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  recepcao: 'bg-blue-100 text-blue-700',
  profissional: 'bg-emerald-100 text-emerald-700',
  unknown: 'bg-gray-100 text-gray-700',
};

export default function Auditoria() {
  const [filtros, setFiltros] = useState({
    action: '', entity_type: '', actor_type: '',
    data_inicio: '', data_fim: '',
  });
  const [page, setPage] = useState(1);
  const [detalhe, setDetalhe] = useState(null);

  const { data: actionsResp } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => auditLogAPI.actions(),
  });
  const actions = actionsResp?.data?.data || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-log', filtros, page],
    queryFn: () => auditLogAPI.list({ ...filtros, page, per_page: 50 }),
  });

  const rows = data?.data?.data || [];
  const pagination = data?.data?.pagination || { total: 0, page: 1, per_page: 50 };
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.per_page));

  const setFiltro = (k, v) => { setFiltros((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
          <Shield size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Auditoria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Rastro de ações sensíveis: cancelamentos, ajustes de estoque, edições financeiras.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <select
          value={filtros.action}
          onChange={(e) => setFiltro('action', e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl"
        >
          <option value="">Todas as ações</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filtros.entity_type}
          onChange={(e) => setFiltro('entity_type', e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl"
        >
          <option value="">Toda entidade</option>
          <option value="venda">Venda</option>
          <option value="produto">Produto</option>
          <option value="fechamento">Fechamento</option>
          <option value="comissao">Comissão</option>
          <option value="agendamento">Agendamento</option>
          <option value="atendimento">Atendimento</option>
        </select>
        <select
          value={filtros.actor_type}
          onChange={(e) => setFiltro('actor_type', e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl"
        >
          <option value="">Todos perfis</option>
          <option value="admin">Admin</option>
          <option value="recepcao">Recepção</option>
          <option value="profissional">Profissional</option>
        </select>
        <input
          type="date"
          value={filtros.data_inicio}
          onChange={(e) => setFiltro('data_inicio', e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl"
        />
        <input
          type="date"
          value={filtros.data_fim}
          onChange={(e) => setFiltro('data_fim', e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl"
        />
      </div>

      {isLoading && <div className="text-center py-8 text-gray-500"><Loader2 className="animate-spin mx-auto" size={28} /></div>}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/30 rounded-xl p-3 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error.response?.data?.error || error.message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {rows.length === 0 && !isLoading ? (
          <div className="p-12 text-center">
            <Search className="mx-auto text-gray-400 mb-3" size={40} />
            <p className="text-gray-500 dark:text-gray-400">Nenhum registro com esses filtros.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setDetalhe(r)}
                className="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{r.action}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ACTOR_BADGE[r.actor_type] || ACTOR_BADGE.unknown}`}>
                      {r.actor_type}
                    </span>
                    {r.entity_type && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {r.entity_type}#{r.entity_id}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Clock size={12} /> {fmtDate(r.created_at)}
                    {r.actor_nome ? ` · ${r.actor_nome}` : ''}
                    {r.after_data?.motivo ? ` · "${r.after_data.motivo}"` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Página {page} de {totalPages} · {pagination.total} registros
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {detalhe && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{detalhe.action}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {detalhe.entity_type ? `${detalhe.entity_type}#${detalhe.entity_id}` : ''}
                  {' · '}{fmtDate(detalhe.created_at)}
                </p>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-gray-700 dark:text-gray-200">
                <div><strong>Perfil:</strong> {detalhe.actor_type}</div>
                <div><strong>Usuário:</strong> {detalhe.actor_nome || `#${detalhe.actor_id}`}</div>
                <div><strong>Email:</strong> {detalhe.actor_email || '-'}</div>
                <div><strong>IP:</strong> {detalhe.ip || '-'}</div>
              </div>
              <DataBlock label="Antes" data={detalhe.before_data} />
              <DataBlock label="Depois" data={detalhe.after_data} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataBlock({ label, data }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return (
      <div>
        <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
        <p className="text-sm text-gray-400 italic">vazio</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
