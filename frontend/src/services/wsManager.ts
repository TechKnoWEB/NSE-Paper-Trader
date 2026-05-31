type MessageHandler = (data: Record<string, unknown>) => void;

class WSManager {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private token: string | null = null;

  connect(token: string): void {
    this.token = token;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: MessageHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private createConnection(): void {
    if (!this.token) return;

    this.ws = new WebSocket(`ws://localhost:8000/ws/market-feed?token=${this.token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private reconnect(): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;
    setTimeout(() => this.createConnection(), delay);
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const parsed = JSON.parse(event.data as string) as Record<string, unknown>;
      const msgType = (parsed?.type as string) ?? 'tick';
      const handlers = this.handlers.get(msgType);
      if (handlers) {
        handlers.forEach((handler) => handler(parsed));
      }
    } catch {
      // ignore malformed messages
    }
  }
}

export const wsManager = new WSManager();
