/**
 * Backup local (P4-C6).
 *
 * UI mínima para o user fazer snapshot do SQLite via backend embarcado:
 *  - botão "Criar backup" → POST /api/backup/create
 *  - lista de backups disponíveis (GET /api/backup/local)
 *  - botão "Restaurar" por linha (POST /api/backup/restore/:filename)
 *
 * Cloud (Google Drive) ainda não disponível — banner explicativo.
 */
import { useState, useEffect } from 'react';
import { Database, Plus, Cloud, RefreshCw, AlertCircle, CheckCircle, Archive } from 'lucide-react';
import api from '../services/api';

function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(ms) {
  try {
    return new Date(ms).toLocaleString('pt-BR');
  } catch (_) {
    return String(ms);
  }
}

export default function Backup() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/backup/local');
      setList(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Falha ao listar backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/backup/create');
      setSuccess(`Backup criado: ${res.data?.data?.filename || ''}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Falha ao criar backup');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename) => {
    if (!window.confirm(`Restaurar backup ${filename}? O sistema reiniciará após restore.`)) return;
    setRestoring(filename);
    setError('');
    setSuccess('');
    try {
      await api.post(`/backup/restore/${encodeURIComponent(filename)}`);
      setSuccess('Backup restaurado. Aguarde o reinício automático...');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Falha ao restaurar backup');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Database size={24} className="text-gray-600 dark:text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Backup e Restauração</h1>
      </div>

      {/* P4-C6: aviso de Google Drive não disponível */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 rounded-md p-4 mb-4 flex items-start gap-2">
        <Cloud size={20} className="flex-shrink-0 mt-0.5 text-blue-500" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Backup em nuvem (Google Drive)</strong> ainda não está disponível no app desktop.
          Use backup local — os arquivos ficam em <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">userData/SoftHair/database/backups/</code>.
          Para camada extra de segurança, copie esses arquivos para um pendrive ou pasta sincronizada (OneDrive, Dropbox).
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 text-green-700 dark:text-green-300 px-4 py-2.5 rounded-md text-sm mb-4 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-md text-sm mb-4 flex items-start gap-2">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Backups locais</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} /> Atualizar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={16} /> {creating ? 'Criando...' : 'Criar backup'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">Carregando...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center gap-2">
            <Archive size={32} />
            <span>Nenhum backup ainda. Crie o primeiro.</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {list.map((f) => (
              <div key={f.filename} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-mono text-sm text-gray-800 dark:text-gray-100">{f.filename}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatBytes(f.size)} {' '} {formatDate(f.mtime)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(f.filename)}
                  disabled={!!restoring}
                  className="px-3 py-1.5 rounded-md text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {restoring === f.filename ? 'Restaurando...' : 'Restaurar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
