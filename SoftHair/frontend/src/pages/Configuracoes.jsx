import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, CheckCircle, Keyboard } from 'lucide-react';

const DEFAULT_BIND = { key: 'k', meta: true, ctrl: false };
const getBind = () => { try { return JSON.parse(localStorage.getItem('launcher_bind') || 'null') || DEFAULT_BIND; } catch { return DEFAULT_BIND; } };
const saveBind = (b) => localStorage.setItem('launcher_bind', JSON.stringify(b));
const bindLabel = (b) => `${b.meta ? '⌘/' : ''}${b.ctrl ? 'Ctrl+' : ''}${b.key.toUpperCase()}`;

export default function Configuracoes() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [bind, setBind] = useState(getBind);
  const [recording, setRecording] = useState(false);

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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
    </div>
  );
}
