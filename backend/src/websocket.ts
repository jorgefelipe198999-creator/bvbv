import type { Server } from "node:http";

import { WebSocketServer, type WebSocket } from "ws";

import { config } from "./config.js";
import { store } from "./store.js";
import type { MqttStatus } from "./mqtt.js";

export function createWebSocketLayer(server: Server, getStatus: () => MqttStatus) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const MAX_BUFFERED_BYTES = 1_000_000;

  const closeSlowSocket = (socket: WebSocket) => {
    if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING) {
      try {
        socket.close(1013, "client is too slow");
      } catch {
        socket.terminate();
      }
      return;
    }

    socket.terminate();
  };

  const send = (socket: WebSocket, payload: unknown) => {
    if (socket.readyState !== socket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      closeSlowSocket(socket);
      return;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      closeSlowSocket(socket);
    }
  };

  const broadcast = (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    for (const socket of [...wss.clients]) {
      if (socket.readyState !== socket.OPEN) continue;
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        closeSlowSocket(socket);
        continue;
      }

      try {
        socket.send(serialized);
      } catch {
        closeSlowSocket(socket);
      }
    }
  };

  const statusFrame = () => ({
    type: "status" as const,
    mqtt: getStatus(),
    broker: config.mqttUrl,
    topic: config.mqttTopic,
  });

  wss.on("connection", (socket) => {
    socket.on("error", () => undefined);
    send(socket, statusFrame());
  });

  store.on("change", (payload: { event: string; ts: number; cycle?: unknown; piece?: unknown }) => {
    broadcast({ type: "event", ...payload });
  });

  const heartbeat = setInterval(() => {
    if (wss.clients.size > 0) broadcast(statusFrame());
  }, 15000);
  wss.on("close", () => clearInterval(heartbeat));

  return { wss, broadcastStatus: () => broadcast(statusFrame()) };
}
