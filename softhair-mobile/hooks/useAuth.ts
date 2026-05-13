import { useRouter } from 'expo-router';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { wsManager } from '../services/websocket';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

async function registerPushToken(userType: 'cliente' | 'profissional') {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const endpoint = userType === 'profissional'
      ? '/app/profissional/auth/push-token'
      : '/app/auth/push-token';
    await api.put(endpoint, { pushToken: token });
  } catch (e) {
    console.warn('Falha ao registrar push token:', e);
  }
}

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const loginCliente = async (email: string, password: string) => {
    const response = await api.post('/app/auth/login', { email, password });
    const { user, token } = response.data.data;
    const userWithId = { ...user, clienteAppId: user.id };
    await store.setAuth(userWithId, token, 'cliente');
    wsManager.connect(user.id, 'cliente');
    registerPushToken('cliente');
    router.replace('/(cliente)/(tabs)');
  };

  const loginProfissional = async (email: string, password: string) => {
    const response = await api.post('/app/profissional/auth/login', {
      email,
      password,
    });
    const { user, token } = response.data.data;
    await store.setAuth(user, token, 'profissional');
    wsManager.connect(user.profissionalId, 'profissional');
    registerPushToken('profissional');
    router.replace('/(profissional)/(tabs)' as any);
  };

  const registerCliente = async (
    nome: string,
    email: string,
    password: string,
    telefone: string,
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
    registerPushToken('cliente');
    router.replace('/(cliente)/(tabs)');
  };

  const logout = async () => {
    wsManager.disconnect();
    await store.logout();
    router.replace('/(auth)/login');
  };

  return { ...store, loginCliente, loginProfissional, registerCliente, logout };
}
