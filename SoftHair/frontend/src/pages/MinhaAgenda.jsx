import { lazy, Suspense } from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Agenda = lazy(() => import('./Agenda'));

/**
 * Página do PROFISSIONAL. Reutiliza o componente Agenda — o backend já filtra
 * agendamentos por profissional_id quando o usuário logado é profissional.
 * Apenas adiciona um cabeçalho contextualizado.
 */
export default function MinhaAgenda() {
  const { user } = useAuth();
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
          <Calendar size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Minha agenda</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Olá, {user?.nome || 'profissional'} — abaixo só aparecem agendamentos vinculados a você.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="text-center py-12 text-gray-500">Carregando…</div>}>
        <Agenda />
      </Suspense>
    </div>
  );
}
