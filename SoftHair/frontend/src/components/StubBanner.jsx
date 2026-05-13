/**
 * P5-C3: banner reutilizável para telas com endpoint backend stubado.
 *
 * Mostra quando uma resposta da API trazia `{ stub: true, message: '...' }`.
 * Em vez de renderizar "Nenhum registro" (UI hostil que confunde),
 * o user vê uma mensagem clara de "em desenvolvimento".
 *
 * Uso:
 *   const { data, isStub, stubMessage } = useStubAwareQuery(...);
 *   return isStub ? <StubBanner message={stubMessage} /> : <Tabela rows={data} />;
 *
 * Componente puro — sem deps de React Query. Pode ser usado em qualquer
 * tela que detecte a flag no payload da resposta.
 */
import { AlertTriangle } from 'lucide-react';

export default function StubBanner({ message, title = 'Funcionalidade em desenvolvimento' }) {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4 flex items-start gap-3">
      <AlertTriangle className="flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" size={20} />
      <div className="flex-1">
        <div className="font-medium text-yellow-900 dark:text-yellow-100">{title}</div>
        <div className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
          {message ||
            'Esta tela está em desenvolvimento na versão desktop. ' +
              'Sincronize com a versão online (Sistema → Sync Cloud) para acessá-la, ' +
              'ou aguarde a próxima atualização.'}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper: detecta se uma resposta axios indica stub.
 * Uso: `if (isStubResponse(res)) { ... }`
 */
export function isStubResponse(res) {
  if (!res) return false;
  // Axios wrap: res.data; nosso backend embarcado retorna res.data?.stub
  if (res?.data && typeof res.data === 'object' && res.data.stub === true) return true;
  // Caso o payload seja desempacotado (rare)
  if (res?.stub === true) return true;
  return false;
}

/**
 * Helper: extrai message do payload stub.
 */
export function getStubMessage(res) {
  return res?.data?.message || res?.message || null;
}
