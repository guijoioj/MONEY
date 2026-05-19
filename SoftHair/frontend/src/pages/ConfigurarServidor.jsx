import { useEffect, useState } from 'react';
import { Server, Cloud, HardDrive, Settings, Check, X, Loader2 } from 'lucide-react';

/**
 * ConfigurarServidor — escolhe onde o app conecta:
 *   - embarcado: backend SQLite local (default)
 *   - local:     IP do PC servidor no salão (cérebro)
 *   - render:    https://money-f5rz.onrender.com
 *   - custom:    URL livre
 *
 * Lê/grava via window.electron.serverConfig (IPC).
 * Se rodando fora do Electron, mostra mensagem informativa.
 */

const DEFAULT_PRESETS = {
  embarcado: 'http://127.0.0.1:3001',
  local: 'http://192.168.1.10:3001',
  render: 'https://money-f5rz.onrender.com',
};

export default function ConfigurarServidor() {
  const isElectron = typeof window !== 'undefined' && !!window.electron?.serverConfig;
  const [mode, setMode] = useState('embarcado');
  const [url, setUrl] = useState(DEFAULT_PRESETS.embarcado);
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!isElectron) return;
    Promise.all([
      window.electron.serverConfig.get(),
      window.electron.serverConfig.presets(),
    ]).then(([cfg, ps]) => {
      setMode(cfg.mode || 'embarcado');
      setUrl(cfg.url || ps.embarcado);
      setPresets(ps);
    });
  }, [isElectron]);

  const applyPreset = (m) => {
    setMode(m);
    if (m !== 'custom' && presets[m]) setUrl(presets[m]);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const latency = Date.now() - start;
      if (res.ok) setTestResult({ ok: true, latency });
      else setTestResult({ ok: false, error: `HTTP ${res.status}` });
    } catch (e) {
      setTestResult({ ok: false, error: e.message || 'Erro de rede' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('URL deve começar com http:// ou https://');
      return;
    }
    setSaving(true);
    setSavedMessage('');
    try {
      const r = await window.electron.serverConfig.set({ mode, url });
      if (r?.ok) {
        setSavedMessage('Configuração salva! Feche e reabra o app pra aplicar.');
      } else {
        setSavedMessage('Falha ao salvar.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isElectron) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Configurar Servidor</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Esta tela só funciona no app Electron. No browser, configure via variável de ambiente <code>VITE_API_URL</code>.
          </p>
        </div>
      </div>
    );
  }

  const OptionCard = ({ value, icon: Icon, title, desc, urlText }) => (
    <button
      type="button"
      onClick={() => applyPreset(value)}
      className={`w-full text-left p-4 rounded-lg border-2 transition mb-3 ${
        mode === value
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-6 h-6 mt-0.5" style={{ color: mode === value ? '#6366f1' : '#6b7280' }} />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
          {urlText && (
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">{urlText}</p>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurar Servidor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Escolha onde este Electron vai se conectar. Mudanças aplicam após reiniciar o app.
        </p>
      </div>

      <OptionCard
        value="embarcado"
        icon={HardDrive}
        title="🖥️ Servidor embarcado (local SQLite)"
        desc="Backend roda dentro do próprio Electron. Banco SQLite local. Bom pra 1 PC standalone."
        urlText={presets.embarcado}
      />

      <OptionCard
        value="local"
        icon={Server}
        title="🏠 Servidor local do salão (cérebro)"
        desc="Aponta pro PC servidor na LAN. Funciona offline. Recomendado pra 3+ PCs no mesmo salão."
        urlText={presets.local}
      />

      <OptionCard
        value="render"
        icon={Cloud}
        title="☁️ Servidor na nuvem (Render)"
        desc="Aponta pra produção hospedada. Requer internet sempre."
        urlText={presets.render}
      />

      <OptionCard
        value="custom"
        icon={Settings}
        title="⚙️ Customizado"
        desc="URL específica (outro IP local, staging, dev, etc)."
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL do servidor</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={mode !== 'custom'}
          placeholder="https://exemplo.com ou http://192.168.1.10:3001"
          className={`w-full px-3 py-2 border rounded font-mono text-sm ${
            mode === 'custom'
              ? 'border-indigo-300 bg-white dark:bg-gray-900'
              : 'border-gray-200 bg-gray-50 dark:bg-gray-700 text-gray-500'
          }`}
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Testar Conexão
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 p-3 rounded text-sm flex items-center gap-2 ${
            testResult.ok
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            {testResult.ok
              ? <><Check className="w-4 h-4" /> Conectou! Latência: {testResult.latency}ms</>
              : <><X className="w-4 h-4" /> Falhou: {testResult.error}</>
            }
          </div>
        )}

        {savedMessage && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-sm">
            {savedMessage}
          </div>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p><strong>Embarcado:</strong> backend SQLite roda dentro do Electron. Sem comissões V2.</p>
        <p><strong>Cérebro local:</strong> PC dedicado no salão com PostgreSQL. Recomendado pra 3+ PCs.</p>
        <p><strong>Render:</strong> hospedagem cloud, sempre atualizado, requer internet.</p>
      </div>
    </div>
  );
}
