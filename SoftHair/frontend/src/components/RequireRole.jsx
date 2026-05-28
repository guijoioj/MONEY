import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

/**
 * Guarda de rota por role.
 *
 * Uso:
 *   <RequireRole roles="admin"><Page /></RequireRole>
 *   <RequireRole roles={['admin','recepcao']}><Page /></RequireRole>
 *
 * Comportamento:
 *   - Sem login → redireciona /login mantendo `from`.
 *   - Loading → spinner discreto.
 *   - Logado mas sem permissão → tela 403 com link pra home do role.
 */
export default function RequireRole({ roles, children }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRole(allowed)) {
    return <ForbiddenScreen userRole={user.role} requiredRoles={allowed} />;
  }

  return children;
}

function ForbiddenScreen({ userRole, requiredRoles }) {
  const home = roleHome(userRole);
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <ShieldAlert className="text-red-600 dark:text-red-400" size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Acesso restrito
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Esta área é restrita a: <strong>{requiredRoles.join(' ou ')}</strong>.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Seu perfil atual: <strong>{labelRole(userRole)}</strong>.
        </p>
        <a
          href={home}
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          Voltar para o início
        </a>
      </div>
    </div>
  );
}

export function labelRole(r) {
  if (r === 'admin') return 'Administrador';
  if (r === 'recepcao') return 'Recepção';
  if (r === 'profissional') return 'Profissional';
  return r || 'desconhecido';
}

export function roleHome(role) {
  if (role === 'profissional') return '/minha-agenda';
  if (role === 'recepcao')     return '/agenda';
  return '/dashboard'; // admin abre direto no Dashboard (antes era '/', que dava loop no index)
}
