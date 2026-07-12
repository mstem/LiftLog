import { apiBaseUrl } from '@/services/api-consts';

export const HubConnectionState = {
  Connected: 'Connected',
  Disconnected: 'Disconnected',
  Connecting: 'Connecting',
  Reconnecting: 'Reconnecting',
  Disconnecting: 'Disconnecting',
} as const;

export type HubConnectionStateType =
  (typeof HubConnectionState)[keyof typeof HubConnectionState];

export class SimpleHubConnection {
  state: HubConnectionStateType = HubConnectionState.Disconnected;
  private ws: WebSocket | null = null;
  private eventListeners = new Map<string, Set<(...args: any[]) => void>>();
  private closeHandlers: Array<(e?: Error) => void> = [];
  private pendingInvokes = new Map<string, () => void>();
  private invokeCounter = 0;

  constructor(private url: string) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.state = HubConnectionState.Connecting;

      this.ws.onopen = () => {
        this.state = HubConnectionState.Connected;
        resolve();
      };

      this.ws.onerror = () => {
        this.state = HubConnectionState.Disconnected;
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (e) => {
        this.state = HubConnectionState.Disconnected;
        const error =
          e.code !== 1000
            ? new Error(`WebSocket closed: ${e.code}`)
            : undefined;
        this.closeHandlers.forEach((h) => h(error));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'complete' && msg.id != null) {
            const resolve = this.pendingInvokes.get(msg.id);
            if (resolve) {
              resolve();
              this.pendingInvokes.delete(msg.id);
            }
          } else if (msg.type === 'ReceiveMessage') {
            const handlers = this.eventListeners.get('ReceiveMessage');
            handlers?.forEach((h) => h(msg.data));
          }
        } catch {
          // ignore malformed messages
        }
      };
    });
  }

  stop(): Promise<void> {
    this.ws?.close(1000);
    this.ws = null;
    this.state = HubConnectionState.Disconnected;
    return Promise.resolve();
  }

  invoke(method: string, ...args: any[]): Promise<void> {
    const id = String(++this.invokeCounter);
    return new Promise((resolve) => {
      this.pendingInvokes.set(id, resolve);
      this.ws?.send(JSON.stringify({ method, args, id }));
    });
  }

  send(method: string, ...args: any[]): Promise<void> {
    this.ws?.send(JSON.stringify({ method, args, id: null }));
    return Promise.resolve();
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string): void {
    this.eventListeners.delete(event);
  }

  onclose(callback: (e?: Error) => void): void {
    this.closeHandlers.push(callback);
  }
}

export class HubConnectionFactory {
  create() {
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws') + '/ai-chat';
    return new SimpleHubConnection(wsUrl);
  }
}
