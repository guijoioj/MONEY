import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, CheckCircle, Keyboard, Trash2, ShieldAlert, AlertCircle } from 'lucide-react';
import api from '../services/api';

const DEFAULT_BIND = { key: 'k', meta: true, ctrl: false };
const getBind = () => { try { return JSON.parse(localStorage.getItem('launcher_bind') || 'null') || DEFAULT_BIND; } catch { return DEFAULT_BIND; } };
const saveBind = (b) => localStorage.setItem('launcher_bind', JSON.stringify(b));
const bindLabel = (b) => `${b.meta ? '⌘/' : ''}${b.ctrl ? 'Ctrl+' : ''}${b.key.toUpperCase()}`;

// P6-C3: modal de confirmação para "Apagar todos os dados deste salão" (LGPD).
function DeleteDataModal({ open, onClose }) {
  const [senha, setSenha] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setErr('');
    setLoading(true);
    try {
      await api.post('/auth/me/delete-account-data', { senha });
      setDone(true);
      // Backend dispara process.exit em ~1.5s; Electron faz fork novo, ou em
      // dev mode o user reinicia manual.
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Falha ao apagar dados');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <ShieldAlert className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Apagar todos os dados deste salão
          </h2>
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 text-green-700 dark:text-green-300 px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
              <CheckCircle size={18} />
              Dados apagados. O aplicativo será reiniciado em instantes.
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              Esta ação apaga <strong>permanentemente</strong> todos os dados deste salão:
              clientes, agendamentos, atendimentos, vendas, produtos, serviços,
              despesas, comissões e configurações.
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4 font-medium">
              Faça <strong>backup</strong> antes (Sistema → Backup).
            </p>

            {err && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-md text-sm mb-3 flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Confirme sua senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                  autoComplete="current-password"
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Entendo que esta ação é irreversível.</span>
              </label>
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!understood || !senha || loading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [bind, setBind] = useState(getBind);
  const [recording, setRecording] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const handler = (e) => {
      e.preventDefault();
      if (['Meta','Control','Shift','Alt'].includes(e.key)) return;
      const newBind = { key: e.key, meta: e.metaKey || e.ctrlKey, ctrl: e.ctrlKey };
      setBind(newBind);
      saveBind(newBind);
      setRecording(false);
      setMessage('Atalho salvo!');
      setTimeout(() => setMessage(''), 2000);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [recording]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Configurações</h1>

      {message && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle size={18} />{message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-100 rounded-lg"><User className="text-indigo-600 dark:text-indigo-400" size={24} /></div>
          <div><h2 className="text-lg font-semibold">Perfil</h2><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Suas informações pessoais</p></div>
        </div>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <p><span className="font-medium">Nome:</span> {user?.nome || user?.name || '—'}</p>
          <p><span className="font-medium">Email:</span> {user?.email || '—'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-purple-100 rounded-lg"><Keyboard className="text-purple-600 dark:text-purple-400" size={24} /></div>
          <div><h2 className="text-lg font-semibold">Atalho do Launcher</h2><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Tecla para abrir o Raycast (⌘K)</p></div>
        </div>
        <div className="flex items-center gap-4">
          <kbd className="px-4 py-2 rounded-xl text-lg font-mono font-bold border-2" style={{ borderColor: recording ? '#5e6ad2' : '#e5e7eb', background: recording ? 'rgba(94,106,210,0.08)' : '#f9fafb', color: '#1a1a2e', minWidth: 80, textAlign: 'center' }}>
            {recording ? '...' : bindLabel(bind)}
          </kbd>
          <button
            onClick={() => setRecording(r => !r)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: recording ? 'rgba(220,38,38,0.1)' : 'rgba(94,106,210,0.1)', color: recording ? '#dc2626' : '#5e6ad2' }}
          >
            {recording ? 'Pressione uma tecla…' : 'Alterar atalho'}
          </button>
          <button onClick={() => { setBind(DEFAULT_BIND); saveBind(DEFAULT_BIND); setMessage('Resetado!'); setTimeout(() => setMessage(''), 1500); }}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 underline">resetar</button>
        </div>
      </div>

      {/* P6-C3: Privacidade e dados (LGPD) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <ShieldAlert className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Privacidade e Dados</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Conforme LGPD art. 18 — direito à exclusão.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
          Apagar permanentemente todos os dados deste salão (clientes, agendamentos,
          vendas, despesas, etc.) e arquivos de configuração. Útil para descomissionar
          a instalação ou transferir o computador. <strong>Faça backup antes</strong>.
        </p>
        <button
          onClick={() => setDeleteOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border-2 border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 size={16} />
          Apagar todos os dados deste salão
        </button>
      </div>

      <DeleteDataModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
