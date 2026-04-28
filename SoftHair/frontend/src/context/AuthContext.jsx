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
    const token = authToken || localStorage.getItem('token');
    if (token) {
      authToken = token;
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
    localStorage.setItem('token', token);
    setUser(user);
    return res.data.data;
  };

  const handleRegister = async (data) => {
    const res = await authAPI.register(data);
    const { token, user } = res.data.data;
    authToken = token;
    authUser = user;
    localStorage.setItem('token', token);
    setUser(user);
    return res.data.data;
  };

  const handleLogout = () => {
    authToken = null;
    authUser = null;
    localStorage.removeItem('token');
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
