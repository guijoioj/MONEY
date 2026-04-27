import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { wsManager } from '../services/websocket';
import api from '../services/api';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const loginCliente = async (email: string, password: string) => {
    const response = await api.post('/app/auth/login', { email, password });
    const { user, token } = response.data;
    const userWithId = { ...user, clienteAppId: user.id };
    await store.setAuth(userWithId, token, 'cliente');
    wsManager.connect(user.id, 'cliente');
    router.replace('/(cliente)/(tabs)');
  };

  const loginProfissional = async (email: string, password: string) => {
    const response = await api.post('/app/auth/profissional/login', {
      email,
      password,
    });
    const { user, token } = response.data;
    await store.setAuth(user, token, 'profissional');
    wsManager.connect(user.profissionalId, 'profissional');
    router.replace('/(profissional)/(tabs)');
  };

  const registerCliente = async (
    nome: string,
    email: string,
    password: string,
    telefone: string,
  ) => {
    const response = await api.post('/app/auth/register', {
      nome,
      email,
      password,
      telefone,
    });
    const { user, token } = response.data;
    const userWithId = { ...user, clienteAppId: user.id };
    await store.setAuth(userWithId, token, 'cliente');
    wsManager.connect(user.id, 'cliente');
    router.replace('/(cliente)/(tabs)');
  };

  const logout = async () => {
    wsManager.disconnect();
    await store.logout();
    router.replace('/(auth)/login');
  };

  return { ...store, loginCliente, loginProfissional, registerCliente, logout };
}
