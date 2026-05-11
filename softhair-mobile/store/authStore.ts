import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type UserType = 'cliente' | 'profissional' | null;

export interface AuthUser {
  id: string;
  nome?: string;
  name?: string;
  email: string;
  telefone?: string;
  salonId?: string;
  profissionalId?: string;
  clienteAppId?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  userType: UserType;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (user: AuthUser, token: string, type: UserType) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

// SECURITY: token vai em SecureStore (Keychain iOS / Keystore Android).
// AsyncStorage segue sendo usado para dados não-sensíveis (user, userType).
const TOKEN_KEY = 'softhair_token';
const LEGACY_TOKEN_KEY = '@softhair:token';

async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    // Fallback (web/Expo Go onde SecureStore não está disponível)
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
  }
}

async function getToken(): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(TOKEN_KEY);
    if (v) return v;
  } catch {}
  // Migração: se existir token em AsyncStorage de versões anteriores, migra
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      try { await SecureStore.setItemAsync(TOKEN_KEY, legacy); } catch {}
      try { await AsyncStorage.removeItem(LEGACY_TOKEN_KEY); } catch {}
      return legacy;
    }
  } catch {}
  return null;
}

async function deleteToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
  try { await AsyncStorage.removeItem(LEGACY_TOKEN_KEY); } catch {}
}

// Exporta para outros módulos (ex.: services/api.ts) consumirem
export const tokenStorage = { setToken, getToken, deleteToken };

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  userType: null,
  isLoading: false,
  isAuthenticated: false,

  setAuth: async (user, token, type) => {
    await setToken(token);
    await AsyncStorage.setItem('@softhair:user', JSON.stringify(user));
    await AsyncStorage.setItem('@softhair:userType', type ?? '');
    set({ user, token, userType: type, isAuthenticated: true });
  },

  logout: async () => {
    await deleteToken();
    await AsyncStorage.multiRemove([
      '@softhair:user',
      '@softhair:userType',
    ]);
    set({ user: null, token: null, userType: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    set({ isLoading: true });
    try {
      const tokenPromise = getToken();
      const restPromise = AsyncStorage.multiGet(['@softhair:user', '@softhair:userType']);
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));

      const [tokenVal, restResult] = await Promise.race([
        Promise.all([tokenPromise, restPromise]),
        timeout,
      ]) as [string | null, [string, string][]];

      const userVal = restResult[0]?.[1];
      const typeVal = restResult[1]?.[1] as UserType;

      if (tokenVal && userVal) {
        const user = JSON.parse(userVal) as AuthUser;
        set({ token: tokenVal, user, userType: typeVal, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
