import { useEffect, useRef } from 'react';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const isElectronDev = typeof window !== 'undefined' && !!window.electron;

function getWsUrl(tipo, id) {
  // Electron (file:// ou dev) sempre fala com backend embarcado em 3001
  if (isFileProtocol || isElectronDev) {
    return `ws://127.0.0.1:3001/ws?tipo=${tipo}&id=${id}`;
  }
  // Browser web: mesmo host da page
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?tipo=${tipo}&id=${id}`;
}

export function useWebSocket(tipo, id, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!tipo || !id) return;

    let ws;
    let reconnectTimer;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      ws = new WebSocket(getWsUrl(tipo, id));

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tipo !== 'conectado') onMessageRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        if (!unmounted) reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [tipo, id]);
}
