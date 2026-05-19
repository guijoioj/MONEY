/**
 * Configuração de URL do servidor.
 *
 * Permite ao usuário escolher entre:
 *   - Render (cloud) — default
 *   - Cérebro local (IP do PC no salão)
 *   - Custom
 *
 * Persiste em AsyncStorage. Reaplicado no startup via setApiBaseURL.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@softhair:server-config';

export interface ServerConfig {
  mode: 'render' | 'local' | 'custom';
  url: string;
}

export const PRESETS: Record<string, string> = {
  render: 'https://money-f5rz.onrender.com',
  // Default IP comum em LAN — usuário ajusta no painel
  local: 'http://192.168.1.10:3001',
};

export async function getServerConfig(): Promise<ServerConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* noop */ }
  return { mode: 'render', url: PRESETS.render };
}

export async function setServerConfig(cfg: ServerConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(cfg));
}

export async function testConnection(url: string): Promise<{ ok: boolean; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, latency: Date.now() - start };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de rede' };
  }
}
