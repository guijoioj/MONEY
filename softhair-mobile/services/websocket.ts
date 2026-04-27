import { API_BASE_URL } from './api';

type WSListener = (data: WSEvent) => void;

export interface WSEvent {
  tipo: string;
  titulo?: string;
  mensagem?: string;
  pedido?: unknown;
  agendamento?: unknown;
  registro?: unknown;
  profissionalId?: string;
  agendamentoId?: string;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners: WSListener[] = [];
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = false;
  private userId: string | null = null;
  private userType: string | null = null;

  connect(userId: string, userType: 'cliente' | 'profissional') {
    this.userId = userId;
    this.userType = userType;
    this.shouldReconnect = true;
    this.reconnectDelay = 3000;
    this._connect();
  }

  private _connect() {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const url = `${wsUrl}/ws?tipo=${this.userType}&id=${this.userId}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectDelay = 3000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          this.listeners.forEach((fn) => fn(data));
        } catch {}
      };

      this.ws.onclose = () => {
        if (this.shouldReconnect) {
          this.reconnectTimeout = setTimeout(() => {
            this._connect();
            this.reconnectDelay = Math.min(
              this.reconnectDelay * 1.5,
              this.maxReconnectDelay,
            );
          }, this.reconnectDelay);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {}
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws?.close();
    this.ws = null;
    this.userId = null;
    this.userType = null;
  }

  addListener(fn: WSListener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WebSocketManager();
