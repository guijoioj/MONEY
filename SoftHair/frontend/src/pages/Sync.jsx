import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, Lock, LogOut, ShieldAlert, GitMerge } from 'lucide-react';
import api from '../services/api';

// E3: valida que cloudUrl é HTTPS (ou loopback em dev).
function isValidCloudUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') {
      const h = u.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '::1';
    }
    return false;
  } catch {
    return false;
  }
}

export default function Sync() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.get('/sync/status').then((r) => r.data.data),
    refetchInterval: 5000,
  });

  // P6-C2: lista de conflitos pendentes (sync_conflicts onde resolved=0).
  const { data: conflictsData } = useQuery({
    queryKey: ['sync-conflicts'],
    queryFn: () => api.get('/sync/conflicts').then((r) => r.data.data),
    refetchInterval: 10000,
  });
  const conflicts = conflictsData?.conflicts || [];
  const pending = Number(conflictsData?.pending || 0);

  const resolveConflict = useMutation({
    mutationFn: ({ id, choice }) =>
      api.post(`/sync/conflicts/${id}/resolve`, { choice }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] }),
  });

  const [cloudUrl, setCloudUrl] = useState('https://money-f5rz.onrender.com/api');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mode, setMode] = useState('login');
  const [urlError, setUrlError] = useState(null);

  useEffect(() => {
    if (status) {
      if (status.cloudUrl) setCloudUrl(status.cloudUrl);
      setEnabled(!!status.enabled);
    }
  }, [status]);

  useEffect(() => {
    // E3: feedback imediato se a URL não for HTTPS
    if (cloudUrl && !isValidCloudUrl(cloudUrl)) {
      setUrlError('URL inválida — use HTTPS ou loopback (127.0.0.1).');
    } else {
      setUrlError(null);
    }
  }, [cloudUrl]);

  const configure = useMutation({
    mutationFn: (payload) => api.post('/sync/configure', payload).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
  });

  const loginCloud = useMutation({
    mutationFn: (payload) => api.post('/sync/login-cloud', payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
  });

  const syncNow = useMutation({
    mutationFn: () => api.post('/sync/now').then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
  });

  // E9: disconnect — limpa credenciais
  const disconnect = useMutation({
    mutationFn: () => api.post('/sync/disconnect').then((r) => r.data),
    onSuccess: () => {
      setToken('');
      setEmail('');
      setSenha('');
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  const handleSaveConfig = () => {
    if (!isValidCloudUrl(cloudUrl)) {
      setUrlError('URL inválida — use HTTPS ou loopback (127.0.0.1).');
      return;
    }
    configure.mutate({ cloudUrl, token, enabled });
  };

  const handleToggleEnabled = (next) => {
    setEnabled(next);
    configure.mutate({ enabled: next });
  };

  const handleLoginCloud = () => {
    if (!isValidCloudUrl(cloudUrl)) {
      setUrlError('URL inválida — use HTTPS ou loopback (127.0.0.1).');
      return;
    }
    loginCloud.mutate({ cloudUrl, email, senha });
  };

  const handleDisconnect = () => {
    if (window.confirm('Desconectar do cloud? Token e configuração serão apagados deste computador.')) {
      disconnect.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="animate-spin" size={32} />
      </div>
    );
  }

  const isConfigured = !!status?.configured;
  const isEnabled = !!status?.enabled;
  const isSyncing = !!status?.syncing;
  const isInvalidUrl = !!urlError;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--color-text)' }}>
            {isEnabled ? <Cloud className="text-green-500" /> : <CloudOff className="text-gray-400" />}
            Sincronização com Cloud
          </h1>
          <p className="text-sm mt-1 opacity-70">
            Banco local: <strong>{status?.dbType || 'sqlite'}</strong> · Sync com Render: <strong>{isEnabled ? 'ATIVO' : 'desativado'}</strong>
          </p>
        </div>
      </div>

      {/* Toggle ON/OFF */}
      <div className="rounded-xl shadow-md p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Sincronização Automática</h2>
            <p className="text-sm opacity-70 mt-1">
              Quando ativa, os dados locais são enviados/recebidos da nuvem a cada 30s.
            </p>
          </div>
          <button
            onClick={() => handleToggleEnabled(!isEnabled)}
            disabled={!isConfigured && !isEnabled}
            className={`relative inline-flex items-center h-8 rounded-full w-14 transition-colors ${
              isEnabled ? 'bg-green-500' : 'bg-gray-300'
            } ${!isConfigured && !isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={!isConfigured ? 'Configure as credenciais primeiro' : ''}
          >
            <span
              className={`inline-block w-6 h-6 transform bg-white rounded-full shadow transition-transform ${
                isEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {!isConfigured && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm flex items-start gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>Configure URL e credenciais antes de ativar a sincronização.</span>
          </div>
        )}

        {/* E9: Botão "Desconectar" só aparece quando configurado */}
        {isConfigured && (
          <button
            onClick={handleDisconnect}
            disabled={disconnect.isPending}
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut size={14} />
            Desconectar cloud
          </button>
        )}
      </div>

      {/* Status detalhado */}
      <div className="rounded-xl shadow-md p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h2 className="text-lg font-semibold mb-3">Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            {isConfigured ? <CheckCircle className="text-green-500" size={18} /> : <AlertCircle className="text-gray-400" size={18} />}
            <span>Configurado: <strong>{isConfigured ? 'Sim' : 'Não'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            {isEnabled ? <CheckCircle className="text-green-500" size={18} /> : <CloudOff className="text-gray-400" size={18} />}
            <span>Ativo: <strong>{isEnabled ? 'Sim' : 'Não'}</strong></span>
          </div>
          <div className="md:col-span-2">
            Última sincronização: <strong>{status?.lastSync ? new Date(status.lastSync).toLocaleString('pt-BR') : 'nunca'}</strong>
          </div>
          {status?.lastError && (
            <div className="md:col-span-2 text-red-600 text-xs">
              Último erro: {status.lastError}
            </div>
          )}
        </div>

        <button
          onClick={() => syncNow.mutate()}
          disabled={!isConfigured || syncNow.isPending || isSyncing}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <RefreshCw size={16} className={syncNow.isPending || isSyncing ? 'animate-spin' : ''} />
          Sincronizar Agora
        </button>
      </div>

      {/* Config */}
      <div className="rounded-xl shadow-md p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h2 className="text-lg font-semibold mb-4">Configurar Cloud</h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('login')}
            className={`px-4 py-2 rounded-lg text-sm ${
              mode === 'login' ? 'text-white' : 'bg-gray-100 text-gray-700'
            }`}
            style={mode === 'login' ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            Login no Cloud
          </button>
          <button
            onClick={() => setMode('token')}
            className={`px-4 py-2 rounded-lg text-sm ${
              mode === 'token' ? 'text-white' : 'bg-gray-100 text-gray-700'
            }`}
            style={mode === 'token' ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            Usar Token
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">URL do servidor cloud</label>
            <input
              type="text"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                isInvalidUrl ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="https://money-f5rz.onrender.com/api"
            />
            {isInvalidUrl && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <ShieldAlert size={12} />
                {urlError}
              </p>
            )}
          </div>

          {mode === 'login' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Email cloud</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="admin@softhair.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Senha cloud</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={handleLoginCloud}
                disabled={loginCloud.isPending || !cloudUrl || !email || !senha || isInvalidUrl}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Lock size={16} />
                {loginCloud.isPending ? 'Conectando...' : 'Conectar e ativar sync'}
              </button>
              {loginCloud.isError && (
                <p className="text-sm text-red-600">
                  Erro: {loginCloud.error?.response?.data?.error || loginCloud.error?.message}
                </p>
              )}
              {loginCloud.isSuccess && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle size={14} /> Conectado!
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Token JWT</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  placeholder="eyJhbG..."
                />
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={configure.isPending || !cloudUrl || !token || isInvalidUrl}
                className="w-full px-4 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {configure.isPending ? 'Salvando...' : 'Salvar configuração'}
              </button>
              {configure.isError && (
                <p className="text-sm text-red-600">
                  Erro: {configure.error?.response?.data?.error || configure.error?.message}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* P6-C2: painel de conflitos pendentes — last-write-wins detection */}
      {pending > 0 && (
        <div className="rounded-xl shadow-md p-6 border-l-4 border-yellow-500" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <GitMerge className="text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-lg font-semibold">Conflitos de Sincronização Pendentes</h2>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold">
                {pending}
              </span>
            </div>
          </div>
          <p className="text-sm opacity-70 mb-4">
            Mudanças locais conflitam com versões mais antigas vindas da nuvem.
            Escolha qual versão manter para cada registro.
          </p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {conflicts.slice(0, 50).map((c) => (
              <div key={c.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm">
                    <strong>{c.tabela}</strong> #{c.registro_id}
                  </div>
                  <div className="text-xs opacity-60">
                    detectado: {c.detected_at ? new Date(c.detected_at).toLocaleString('pt-BR') : '—'}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-2">
                  <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                    <div className="font-medium mb-1">Local ({c.local_updated_at})</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] max-h-32">
{JSON.stringify(c.local || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="p-2 rounded bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
                    <div className="font-medium mb-1">Remoto ({c.remote_updated_at})</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] max-h-32">
{JSON.stringify(c.remote || {}, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => resolveConflict.mutate({ id: c.id, choice: 'local' })}
                    disabled={resolveConflict.isPending}
                    className="px-3 py-1.5 rounded-md text-xs border border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                  >
                    Manter local
                  </button>
                  <button
                    onClick={() => resolveConflict.mutate({ id: c.id, choice: 'remote' })}
                    disabled={resolveConflict.isPending}
                    className="px-3 py-1.5 rounded-md text-xs border border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                  >
                    Aplicar remoto
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pending > 50 && (
            <p className="text-xs opacity-60 mt-2">
              Mostrando 50 de {pending}. Continue resolvendo para ver os próximos.
            </p>
          )}
        </div>
      )}

      <div className="text-xs opacity-60 text-center">
        Os dados locais ficam sempre no banco SQLite deste computador. A sincronização envia/recebe alterações da nuvem.
      </div>
    </div>
  );
}
