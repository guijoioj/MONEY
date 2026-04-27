import CryptoJS from 'crypto-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY = Constants.expoConfig?.extra?.ENCRYPTION_KEY || 'softhair_encryption_key_default';

export const encryptedStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const encrypted = CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
      await SecureStore.setItemAsync(key, encrypted);
    } catch (error) {
      console.error('Erro ao salvar dado criptografado:', error);
      throw new Error('Não foi possível salvar os dados');
    }
  },
  
  getItem: async (key: string): Promise<string | null> => {
    try {
      const encrypted = await SecureStore.getItemAsync(key);
      if (!encrypted) return null;
      
      const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Erro ao recuperar dado criptografado:', error);
      return null;
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Erro ao remover dado criptografado:', error);
    }
  },
  
  setItemSecure: async (key: string, value: string): Promise<void> => {
    await encryptedStorage.setItem(key, value);
  },
  
  getItemSecure: async (key: string):Promise<string | null> => {
    return await encryptedStorage.getItem(key);
  },
};
