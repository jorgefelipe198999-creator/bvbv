import mqtt, { type MqttClient } from "mqtt";

import { config } from "./config.js";
import { store } from "./store.js";
import type { EventName } from "./types.js";

export type MqttStatus = "connecting" | "online" | "offline";

interface MqttBridge {
  client: MqttClient;
  getStatus: () => MqttStatus;
}

const VALID_EVENTS: EventName[] = ["pieceProduced"];

export function createMqttBridge(onStatusChange: (status: MqttStatus) => void): MqttBridge {
  let status: MqttStatus = "connecting";

  const setStatus = (next: MqttStatus) => {
    if (status === next) return;
    status = next;
    onStatusChange(next);
  };

  const client = mqtt.connect(config.mqttUrl, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    reconnectPeriod: 3000,
    clientId: `nexaline-backend-${Math.random().toString(16).slice(2, 10)}`,
  });

  client.on("connect", () => {
    setStatus("online");
    client.subscribe(config.mqttTopic, (error) => {
      if (error) console.error("[mqtt] subscribe error:", error.message);
      else console.log(`[mqtt] subscribed to ${config.mqttTopic}`);
    });
  });

  client.on("reconnect", () => setStatus("connecting"));
  client.on("close", () => setStatus("offline"));
  client.on("error", (error) => console.error("[mqtt] error:", error.message));

  client.on("message", (_topic, payload) => {
    try {
      const parsed = JSON.parse(payload.toString()) as { event?: string; ts?: unknown };
      const event = parsed.event as EventName | undefined;
      if (!event || !VALID_EVENTS.includes(event)) return;
      const ts = parsed.ts === undefined ? Date.now() : parsed.ts;
      if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0 || ts > Date.now() + 86_400_000)
        return;
      void store.handleEvent(event, ts);
    } catch {
      console.warn("[mqtt] invalid payload ignored");
    }
  });

  return { client, getStatus: () => status };
}
