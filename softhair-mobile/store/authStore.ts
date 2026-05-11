import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  userType: null,
  isLoading: false,
  isAuthenticated: false,

  setAuth: async (user, token, type) => {
    await AsyncStorage.setItem('@softhair:token', token);
    await AsyncStorage.setItem('@softhair:user', JSON.stringify(user));
    await AsyncStorage.setItem('@softhair:userType', type ?? '');
    set({ user, token, userType: type, isAuthenticated: true });
  },

  logout: async () => {
    await AsyncStorage.multiRemove([
      '@softhair:token',
      '@softhair:user',
      '@softhair:userType',
    ]);
    set({ user: null, token: null, userType: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    set({ isLoading: true });
    try {
      const results = await Promise.race([
        AsyncStorage.multiGet(['@softhair:token', '@softhair:user', '@softhair:userType']),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);

      const [token, userStr, userType] = results as unknown as [string, string, string][];
      const tokenVal = token[1];
      const userVal = userStr[1];
      const typeVal = userType[1] as UserType;

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
