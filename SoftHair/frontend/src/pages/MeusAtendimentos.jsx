import { lazy, Suspense } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Atendimentos = lazy(() => import('./Atendimentos'));

export default function MeusAtendimentos() {
  const { user } = useAuth();
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
          <ClipboardCheck size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meus atendimentos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user?.nome ? `${user.nome} — ` : ''}lista filtrada para você.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="text-center py-12 text-gray-500">Carregando…</div>}>
        <Atendimentos />
      </Suspense>
    </div>
  );
}
