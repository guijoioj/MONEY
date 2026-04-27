import { useCallback } from 'react';

export function useNotificacoes() {
  const mostrarNotificacao = useCallback(async (_titulo: string, _corpo: string) => {}, []);

  return { mostrarNotificacao };
}
