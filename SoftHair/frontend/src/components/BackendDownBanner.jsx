/**
 * P7-M4: banner global que escuta `softhair:backend-down` emitido por
 * services/api.js quando o backend embarcado responde com erro de rede
 * (ECONNREFUSED, timeout, !error.response). Em Electron, isso típicamente
 * significa que o processo do backend morreu, está reiniciando, ou crash.
 *
 * Auto-clears quando `softhair:backend-up` chega (próxima request OK).
 *
 * Comportamento:
 *   - Aparece após 1 erro de rede.
 *   - Some 3s após backend voltar.
 *   - User pode fechar manualmente.
 */
import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';

export default function BackendDownBanner() {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const down = (ev) => {
      const detail = ev?.detail || {};
      setInfo(detail);
      setVisible(true);
    };
    const up = () => {
      // Auto-clear quando próxima request retornar OK
      setVisible(false);
      setInfo(null);
    };
    window.addEventListener('softhair:backend-down', down);
    window.addEventListener('softhair:backend-up', up);
    return () => {
      window.removeEventListener('softhair:backend-down', down);
      window.removeEventListener('softhair:backend-up', up);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-16 right-4 z-50 max-w-md bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg shadow-lg p-4 flex items-start gap-3">
      <WifiOff className="flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" size={20} />
      <div className="flex-1">
        <div className="font-medium text-orange-900 dark:text-orange-100 text-sm">
          Conexão com o backend interrompida
        </div>
        <div className="text-xs text-orange-800 dark:text-orange-200 mt-1">
          O serviço local não respondeu. Tentando reconectar automaticamente...
          Se o problema persistir, reinicie o aplicativo.
        </div>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="flex-shrink-0 text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100"
        aria-label="Fechar aviso"
      >
        <X size={18} />
      </button>
    </div>
  );
}
