import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { WebSocket } from "ws";

import { createWebSocketLayer } from "./websocket.js";

test("server accepts many websocket clients without a hard cap", async () => {
  const server = createServer();
  const layer = createWebSocketLayer(server, () => "offline");

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

  const port = (server.address() as { port: number }).port;
  const clients: WebSocket[] = [];

  try {
    for (let index = 0; index < 60; index += 1) {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      clients.push(socket);
      await Promise.race([
        once(socket, "open"),
        once(socket, "close"),
        once(socket, "error"),
      ]).catch(() => undefined);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));

    assert.ok(
      layer.wss.clients.size >= 40,
      `expected a large number of connected clients, got ${layer.wss.clients.size}`,
    );
  } finally {
    for (const socket of clients) {
      if (socket.readyState === socket.OPEN) socket.close();
      else socket.terminate();
    }
    await new Promise<void>((resolve, reject) => {
      layer.wss.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }).catch(() => undefined);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }).catch(() => undefined);
  }
});
