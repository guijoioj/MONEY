import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * ComissoesOfflineBanner — exibe aviso quando backend retorna
 * 503 + error='comissoes_offline_indisponivel' (Electron desconectado do
 * servidor central). Auto-some após 30s.
 *
 * Importado em Layout.jsx pra ficar disponível em todas as telas.
 */
export default function ComissoesOfflineBanner() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onOffline = (e) => {
      setMessage(e.detail?.message || 'Comissões exigem conexão com o servidor central.');
      setShow(true);
      const t = setTimeout(() => setShow(false), 30000);
      return () => clearTimeout(t);
    };
    window.addEventListener('softhair:comissoes-offline', onOffline);
    return () => window.removeEventListener('softhair:comissoes-offline', onOffline);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 text-sm">
          <span className="font-semibold">Modo offline:</span>{' '}
          <span>{message}</span>
        </div>
        <button
          onClick={() => setShow(false)}
          className="p-1 hover:bg-amber-600 dark:hover:bg-amber-700 rounded transition"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
