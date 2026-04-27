import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsManager, WSEvent } from '../services/websocket';
import { useWSStore } from '../store/wsStore';
import { useNotificacoes } from './useNotificacoes';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const { incrementar, setUltimaNotificacao } = useWSStore();
  const { mostrarNotificacao } = useNotificacoes();

  useEffect(() => {
    const remover = wsManager.addListener((event: WSEvent) => {
      if (event.tipo === 'conectado') return;

      setUltimaNotificacao(event);
      incrementar();

      if (event.titulo && event.mensagem) {
        mostrarNotificacao(event.titulo, event.mensagem);
      }

      switch (event.tipo) {
        case 'pedido_aprovado':
        case 'pedido_rejeitado':
          queryClient.invalidateQueries({ queryKey: ['meus-pedidos'] });
          break;
        case 'status_pedido_loja':
          queryClient.invalidateQueries({ queryKey: ['meus-pedidos-loja'] });
          break;
        case 'novo_agendamento':
          queryClient.invalidateQueries({ queryKey: ['agenda'] });
          break;
        case 'aviso_atraso_profissional':
          queryClient.invalidateQueries({ queryKey: ['agenda'] });
          break;
      }
    });

    return remover;
  }, [queryClient, incrementar, setUltimaNotificacao, mostrarNotificacao]);
}
