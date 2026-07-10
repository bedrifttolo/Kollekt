import { API_BASE, getAccessToken } from './api';
import { queryClient } from './queryClient';

export interface RealtimeEvent {
  type: string;
  collectiveCode?: string;
  timestamp?: string;
  payload?: unknown;
}

interface RealtimeOptions {
  onConnected?: () => void;
}

function buildWsUrl(memberName: string, token: string): string {
  // Support both absolute and relative API bases (for example "/api" in production).
  const apiUrl = new URL(API_BASE, window.location.origin);
  const wsUrl = new URL('/ws/collective', apiUrl.origin);
  wsUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  wsUrl.searchParams.set('memberName', memberName);
  // The server authenticates the handshake, so a token is required to connect. Browsers
  // can't set headers on a WebSocket, so it goes in the query string (sent over wss/TLS).
  wsUrl.searchParams.set('token', token);
  return wsUrl.toString();
}

export function connectCollectiveRealtime(
  memberName: string,
  onEvent: (event: RealtimeEvent) => void,
  options?: RealtimeOptions,
): () => void {
  let socket: WebSocket | null = null;
  let closedManually = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let hasConnected = false;

  const connect = async () => {
    if (closedManually) return;
    const token = await getAccessToken();
    if (closedManually) return;
    if (!token) {
      // Not authenticated yet (e.g. token still restoring); retry shortly.
      reconnectTimer = setTimeout(() => void connect(), 2000);
      return;
    }
    socket = new WebSocket(buildWsUrl(memberName, token));
    socket.onopen = () => {
      // A reconnect means the socket was dead (backgrounded / network switch) and we may
      // have missed events published in the meantime. Refetch active queries so the UI
      // can't keep showing stale data. Skipped on the first connect — the caller's own
      // queries have just loaded.
      if (hasConnected) {
        void queryClient.invalidateQueries();
      }
      hasConnected = true;
      options?.onConnected?.();
    };

    socket.onmessage = (raw) => {
      try {
        onEvent(JSON.parse(raw.data as string) as RealtimeEvent);
      } catch {
        // Ignore malformed events to keep the stream resilient.
      }
    };

    socket.onclose = () => {
      if (closedManually) return;
      reconnectTimer = setTimeout(() => void connect(), 2000);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  void connect();

  return () => {
    closedManually = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
