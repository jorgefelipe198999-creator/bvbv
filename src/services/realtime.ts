import type { CycleRecord, PieceRecord, ProductionEvent } from "@/types/production";

export interface RealtimeHandlers {
  onEvent: (event: ProductionEvent) => void;
  onStatus: (info: {
    status: "connecting" | "online" | "offline";
    source: "websocket" | "simulator";
    broker?: string;
    topic?: string;
  }) => void;
}

const defaultWsUrl = (() => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:4000/ws`;
})();

const WS_URL = import.meta.env.VITE_WS_URL ?? defaultWsUrl;

const SIM_TOPIC = "producao/eventos";

/**
 * Live data source. The UI only consumes the authoritative WebSocket stream from
 * the backend so all production information is read from the database layer.
 */
export function createRealtimeSource(handlers: RealtimeHandlers) {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let connectionTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;

  if (!WS_URL) {
    handlers.onStatus({ status: "offline", source: "websocket", broker: "" });
    return () => {
      disposed = true;
    };
  }

  const scheduleReconnect = () => {
    if (disposed || retryTimer) return;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryAttempt, 5));
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (disposed) return;
    handlers.onStatus({ status: "connecting", source: "websocket" });

    try {
      socket = new WebSocket(WS_URL);
    } catch {
      handlers.onStatus({ status: "offline", source: "websocket", broker: WS_URL });
      scheduleReconnect();
      return;
    }

    connectionTimer = setTimeout(() => {
      connectionTimer = null;
      if (socket?.readyState !== WebSocket.OPEN) socket?.close();
    }, 2500);

    socket.onopen = () => {
      if (connectionTimer) clearTimeout(connectionTimer);
      connectionTimer = null;
      retryAttempt = 0;
      handlers.onStatus({
        status: "online",
        source: "websocket",
        broker: WS_URL,
        topic: SIM_TOPIC,
      });
    };

    socket.onmessage = (message) => {
      try {
        const payload = JSON.parse(String(message.data)) as Record<string, unknown>;
        if (payload["type"] === "status") {
          handlers.onStatus({
            status: payload["mqtt"] === "online" ? "online" : "offline",
            source: "websocket",
            broker: String(payload["broker"] ?? WS_URL),
            topic: String(payload["topic"] ?? SIM_TOPIC),
          });
          return;
        }
        const name = (payload["event"] ??
          (payload["payload"] as Record<string, unknown>)?.["event"]) as
          ProductionEvent["event"] | undefined;
        if (name) {
          const cycle = payload["cycle"] as CycleRecord | undefined;
          const piece = payload["piece"] as PieceRecord | undefined;
          const event: ProductionEvent = { event: name, ts: Number(payload["ts"]) || Date.now() };
          if (cycle) event.cycle = cycle;
          if (piece) event.piece = piece;
          handlers.onEvent(event);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    socket.onerror = () => {
      handlers.onStatus({ status: "offline", source: "websocket", broker: WS_URL });
    };

    socket.onclose = () => {
      if (!disposed) {
        handlers.onStatus({ status: "offline", source: "websocket", broker: WS_URL });
        scheduleReconnect();
      }
    };
  };

  connect();

  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (connectionTimer) clearTimeout(connectionTimer);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}
