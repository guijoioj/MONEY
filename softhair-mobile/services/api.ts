import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStorage } from '../store/authStore';
import { getServerConfig } from './serverConfig';

// Default fallback (env > render). Sobrescrito por loadServerBaseURL no startup.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://money-f5rz.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Carrega configuração persistida e aplica no axios.
 * Chamar no _layout.tsx root.
 */
export async function loadServerBaseURL(): Promise<string> {
  try {
    const cfg = await getServerConfig();
    if (cfg?.url) {
      api.defaults.baseURL = cfg.url;
      return cfg.url;
    }
  } catch (_) { /* noop */ }
  return api.defaults.baseURL || API_BASE_URL;
}

/**
 * Atualiza baseURL em runtime (após user salvar nova config).
 */
export function setApiBaseURL(url: string): void {
  api.defaults.baseURL = url;
}

api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.deleteToken();
      await AsyncStorage.removeItem('@softhair:user');
      // O store de auth reagirá ao token ausente no próximo acesso
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? 'Tempo de conexão esgotado' : null) ||
      (!error.response ? 'Sem conexão com o servidor' : 'Erro inesperado');

    error.userMessage = message;
    return Promise.reject(error);
  },
);

export default api;
