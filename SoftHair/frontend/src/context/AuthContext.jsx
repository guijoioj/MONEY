import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

let authToken = null;
let authUser = null;

/**
 * Normaliza o user: garante `role` e `profissionalId` independentemente de
 * o backend devolver `tipo`/`profissional_id` (snake_case) ou já camelizado.
 */
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    role: raw.role || raw.tipo || null,
    tipo: raw.tipo || raw.role || null,
    profissionalId: raw.profissionalId ?? raw.profissional_id ?? null,
    salaoId: raw.salaoId ?? raw.salao_id ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authToken || localStorage.getItem('token');
    if (token) {
      authToken = token;
      if (authUser) {
        setUser(authUser);
        setLoading(false);
      } else {
        authAPI.me()
          .then(res => {
            const u = normalizeUser(res.data.data || res.data.user);
            authUser = u;
            setUser(u);
          })
          .catch(() => {
            authToken = null;
            localStorage.removeItem('token');
            setUser(null);
          })
          .finally(() => setLoading(false));
      }
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email, password) => {
    const res = await authAPI.login({ email, senha: password });
    const { token, user: rawUser } = res.data.data;
    const u = normalizeUser(rawUser);
    authToken = token;
    authUser = u;
    localStorage.setItem('token', token);
    setUser(u);
    return { token, user: u };
  };

  const handleLogout = () => {
    authToken = null;
    authUser = null;
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    loading,
    login: handleLogin,
    logout: handleLogout,
    isAuthenticated: !!user,
    // Helpers de role
    role: user?.role || null,
    profissionalId: user?.profissionalId || null,
    isAdmin: user?.role === 'admin',
    isRecepcao: user?.role === 'recepcao',
    isProfissional: user?.role === 'profissional',
    hasRole: (roles) => {
      if (!user?.role) return false;
      const arr = Array.isArray(roles) ? roles : [roles];
      return arr.includes(user.role);
    },
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

/** Hook de conveniência: useRole() → string ou null */
export const useRole = () => useAuth().role;
export const useIsAdmin = () => useAuth().isAdmin;
export const useIsRecepcao = () => useAuth().isRecepcao;
export const useIsProfissional = () => useAuth().isProfissional;
