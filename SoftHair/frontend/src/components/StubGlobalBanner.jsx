/**
 * P5-C3: banner global que escuta eventos `softhair:stub-response` emitidos
 * pelo interceptor de axios em services/api.js.
 *
 * Quando uma rota stub responde, mostra um banner amarelo descartável.
 * Stays até o usuário fechar (X). Não persiste entre rotas — reaparece
 * se for chamada nova rota stub.
 *
 * Aditivo: nenhuma tela atual precisa ser modificada. Layout.jsx monta
 * uma vez no nivel app, e o componente lida com toda visualização.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ROUTE_NAMES = {
  '/notificacoes': 'Notificações',
  '/fechamentos': 'Fechamentos',
  '/comissoes': 'Comissões',
  '/creditos': 'Créditos',
  '/historico': 'Histórico',
  '/saloes': 'Salões',
};

function prettifyUrl(url) {
  if (!url) return 'esta funcionalidade';
  try {
    const base = url.split('?')[0];
    for (const [k, v] of Object.entries(ROUTE_NAMES)) {
      if (base.startsWith(k)) return v;
    }
    return base;
  } catch {
    return url;
  }
}

export default function StubGlobalBanner() {
  const [stubInfo, setStubInfo] = useState(null);

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail || {};
      setStubInfo({
        url: detail.url,
        message: detail.message,
        ts: detail.timestamp,
      });
    };
    window.addEventListener('softhair:stub-response', handler);
    return () => window.removeEventListener('softhair:stub-response', handler);
  }, []);

  if (!stubInfo) return null;

  const routeName = prettifyUrl(stubInfo.url);
  const userMessage = stubInfo.message ||
    `A funcionalidade "${routeName}" ainda está em desenvolvimento no app desktop. ` +
    'Para acessá-la agora, ative a sincronização com a nuvem (Sistema → Sync Cloud) ' +
    'ou aguarde a próxima atualização.';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg p-4 flex items-start gap-3">
      <AlertTriangle className="flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" size={20} />
      <div className="flex-1">
        <div className="font-medium text-yellow-900 dark:text-yellow-100 text-sm">
          Funcionalidade em desenvolvimento
        </div>
        <div className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
          {userMessage}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setStubInfo(null)}
        className="flex-shrink-0 text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100"
        aria-label="Fechar aviso"
      >
        <X size={18} />
      </button>
    </div>
  );
}
