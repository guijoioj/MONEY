import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupHistoryAPI } from '../services/api';
import {
  Database, Plus, Download, Trash2, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, Clock, HardDrive,
} from 'lucide-react';

const fmtBytes = (n) => {
  if (!n) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (s) => s ? new Date(s).toLocaleString('pt-BR') : '-';

const STATUS_BADGE = {
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  pending: { label: 'Gerando', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  error: { label: 'Erro', cls: 'bg-rose-100 text-rose-700', icon: AlertCircle },
};

export default function BackupsAdmin() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backups-historico'],
    queryFn: () => backupHistoryAPI.list(),
    refetchInterval: 30_000,
  });
  const backups = data?.data?.data || [];

  const createMut = useMutation({
    mutationFn: () => backupHistoryAPI.create(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups-historico'] });
      setCreating(false);
    },
    onError: () => setCreating(false),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => backupHistoryAPI.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups-historico'] }),
  });

  const handleDownload = async (b) => {
    try {
      const resp = await backupHistoryAPI.download(b.id);
      const blob = new Blob([resp.data], { type: 'application/gzip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `softhair-backup-${b.id}.json.gz`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Falha ao baixar: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Database size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Backups</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Backup automático diário + manual. Histórico dos últimos 14 backups por salão.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => { setCreating(true); createMut.mutate(); }}
            disabled={createMut.isPending}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 font-medium disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Gerar backup agora
          </button>
        </div>
      </div>

      {createMut.isError && (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} /> Falha ao gerar backup: {createMut.error?.response?.data?.error || createMut.error?.message}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8 text-gray-500"><Loader2 className="animate-spin mx-auto" size={28} /></div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/30 rounded-xl p-3 text-sm text-rose-700">
          Erro ao carregar: {error.response?.data?.error || error.message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {backups.length === 0 && !isLoading ? (
          <div className="p-12 text-center">
            <HardDrive className="mx-auto text-gray-400 mb-3" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Nenhum backup ainda</h3>
            <p className="text-gray-500 dark:text-gray-400">Clique em "Gerar backup agora" pra criar o primeiro.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {backups.map((b) => {
              const s = STATUS_BADGE[b.status] || { label: b.status, cls: 'bg-gray-100 text-gray-700', icon: Clock };
              const Icon = s.icon;
              return (
                <div key={b.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.cls}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">#{b.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.tipo === 'auto' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                        {b.tipo}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {fmtDate(b.created_at)} · {fmtBytes(b.tamanho_bytes)}
                      {b.criado_por_nome ? ` · por ${b.criado_por_nome}` : ''}
                    </p>
                    {b.erro && <p className="text-xs text-rose-600 mt-1">{b.erro}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === 'ok' && (
                      <button
                        onClick={() => handleDownload(b)}
                        className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                        title="Baixar"
                      >
                        <Download size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm('Apagar este backup?')) deleteMut.mutate(b.id); }}
                      className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                      title="Apagar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
