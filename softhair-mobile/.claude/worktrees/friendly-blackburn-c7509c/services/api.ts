import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.15.185:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('@softhair:token');
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
      await AsyncStorage.multiRemove(['@softhair:token', '@softhair:user']);
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
