import { createServer } from "node:http";

import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { connectDatabase } from "./db.js";
import { createMqttBridge } from "./mqtt.js";
import { createRoutes } from "./routes.js";
import { createWebSocketLayer } from "./websocket.js";

const app = express();
app.use(cors());
app.use(express.json());

await connectDatabase();

let broadcastStatus: () => void = () => {};
const bridge = createMqttBridge((status) => {
  console.log(`[mqtt] status: ${status}`);
  broadcastStatus();
});

app.use("/api", createRoutes(bridge.getStatus));

const server = createServer(app);
const ws = createWebSocketLayer(server, bridge.getStatus);
broadcastStatus = ws.broadcastStatus;

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  bridge.client.end(true);
  ws.wss.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await (await import("./db.js")).closeDatabase();
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

server.listen(config.port, "0.0.0.0", () => {
  console.log(`[http] API on http://0.0.0.0:${config.port}/api`);
  console.log(`[ws]   WebSocket on ws://0.0.0.0:${config.port}/ws`);
  console.log(`[mqtt] broker ${config.mqttUrl} · topic ${config.mqttTopic}`);
  console.log(`[mongo] connected to ${config.mongodbUri}/${config.mongodbDbName}`);
});
