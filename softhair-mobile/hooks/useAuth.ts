import { useRouter } from 'expo-router';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { wsManager } from '../services/websocket';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const loginCliente = async (email, password) => {
    const response = await api.post('/app/auth/login', { email, password });
    const { user, token } = response.data.data;
    const userWithId = { ...user, clienteAppId: user.id };
    await store.setAuth(userWithId, token, 'cliente');
    wsManager.connect(user.id, 'cliente');
    router.replace('/(cliente)/(tabs)');
  };

  const loginProfissional = async (email, password) => {
    const response = await api.post('/app/profissional/auth/login', {
      email,
      password,
    });
    const { user, token } = response.data.data;
    await store.setAuth(user, token, 'profissional');
    wsManager.connect(user.profissionalId, 'profissional');
    router.replace('/(profissional)/(tabs)');
  };

  const registerCliente = async (
    nome,
    email,
    password,
    telefone,
  ) => {
    let response;
    try {
      response = await api.post('/app/auth/register', { nome, email, password, telefone });
    } catch (err: any) {
      console.error('REGISTER ERROR:', JSON.stringify(err?.response?.data ?? err?.message));
      throw err;
    }
    const { user, token } = response.data.data;
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
