import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Memory-only token storage para máxima segurança (não sobrevive a recarregar página)
let authToken = null;
let authUser = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica se temos estado de auth em memória
    if (authToken && authUser) {
      setUser(authUser);
      authAPI.me()
        .then(res => {
          authUser = res.data.user;
          setUser(res.data.user);
        })
        .catch(() => {
          handleLogout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email, password) => {
    const res = await authAPI.login({ email, password });
    authToken = res.data.token;
    authUser = res.data.user;
    setUser(res.data.user);
    return res.data;
  };

  const handleRegister = async (data) => {
    const res = await authAPI.register(data);
    authToken = res.data.token;
    authUser = res.data.user;
    setUser(res.data.user);
    return res.data;
  };

  const handleLogout = () => {
    authToken = null;
    authUser = null;
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await authAPI.changePassword({ currentPassword, newPassword });
  };

  const forgotPassword = async (email) => {
    await authAPI.forgotPassword(email);
  };

  const resetPassword = async (token, password) => {
    await authAPI.resetPassword(token, password);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login: handleLogin,
      register: handleRegister,
      logout: handleLogout,
      changePassword,
      forgotPassword,
      resetPassword,
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
