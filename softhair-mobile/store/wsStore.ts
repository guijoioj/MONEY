import { create } from 'zustand';
import type { WSEvent } from '../services/websocket';

interface WSState {
  notificacoesNaoLidas: number;
  ultimaNotificacao: WSEvent | null;
  incrementar: () => void;
  zerarNotificacoes: () => void;
  setUltimaNotificacao: (event: WSEvent) => void;
}

export const useWSStore = create<WSState>((set) => ({
  notificacoesNaoLidas: 0,
  ultimaNotificacao: null,

  incrementar: () =>
    set((s) => ({ notificacoesNaoLidas: s.notificacoesNaoLidas + 1 })),

  zerarNotificacoes: () => set({ notificacoesNaoLidas: 0 }),

  setUltimaNotificacao: (event) => set({ ultimaNotificacao: event }),
}));
