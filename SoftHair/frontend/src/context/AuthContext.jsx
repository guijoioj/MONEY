import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import tokenStorage from '../services/tokenStorage';

const AuthContext = createContext(null);

let authToken = null;
let authUser = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // E19: prefere tokenStorage in-memory; localStorage só na inicialização
    const token = tokenStorage.getToken() || authToken || localStorage.getItem('token');
    if (token) {
      authToken = token;
      tokenStorage.setTokens(token, null);
      if (authUser) {
        setUser(authUser);
        setLoading(false);
      } else {
        authAPI.me()
          .then(res => {
            const user = res.data.data || res.data.user;
            authUser = user;
            setUser(user);
          })
          .catch(() => {
            authToken = null;
            tokenStorage.clearTokens();
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
    const { token, user } = res.data.data;
    authToken = token;
    authUser = user;
    // E19: tokenStorage in-memory é a fonte primária; localStorage continua
    // como persistência entre reloads do Electron (sem alternativa segura
    // em renderer com contextIsolation puro até IPC bridge ser feito).
    tokenStorage.setTokens(token, null);
    localStorage.setItem('token', token);
    setUser(user);
    return res.data.data;
  };

  const handleLogout = () => {
    authToken = null;
    authUser = null;
    tokenStorage.clearTokens();
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login: handleLogin,
      logout: handleLogout,
      isAuthenticated: !!authToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de um AuthProvider');
  }
  return context;
};
