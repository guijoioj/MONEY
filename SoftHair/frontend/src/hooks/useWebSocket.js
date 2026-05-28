import { useEffect, useRef } from 'react';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const isElectronDev = typeof window !== 'undefined' && !!window.electron;

// Resolve URL do WS usando o mesmo host da API (serverConfig do Electron OU VITE_API_URL).
// Se a API for HTTPS remota e o servidor não expõe WS, retornamos null e o hook não conecta.
function getWsUrl(tipo, id) {
  try {
    const envUrl = import.meta?.env?.VITE_API_URL;
    let base = envUrl;
    // Em Electron, serverConfig já ajusta api.defaults.baseURL. Lê de window pra simplicidade.
    if (typeof window !== 'undefined' && window.__SH_API_BASE__) base = window.__SH_API_BASE__;
    if (base) {
      const u = new URL(base);
      // Só conectar WS se for localhost — Render free não suporta upgrade.
      if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return null;
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${u.host}/ws?tipo=${tipo}&id=${id}`;
    }
    if (isFileProtocol || isElectronDev) {
      return `ws://127.0.0.1:3001/ws?tipo=${tipo}&id=${id}`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws?tipo=${tipo}&id=${id}`;
  } catch {
    return null;
  }
}

export function useWebSocket(tipo, id, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!tipo || !id) return;
    const url = getWsUrl(tipo, id);
    if (!url) return; // backend remoto sem WS — silenciar tentativas.

    let ws;
    let reconnectTimer;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      ws = new WebSocket(url);

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
