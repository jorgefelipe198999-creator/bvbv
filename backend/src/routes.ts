import { Router, type NextFunction, type Request, type Response } from "express";

import { config } from "./config.js";
import { store } from "./store.js";
import type { MqttStatus } from "./mqtt.js";
import type { ShiftId } from "./types.js";
import { resolveShift } from "./shifts.js";

export function createRoutes(getStatus: () => MqttStatus) {
  const router = Router();
  const asyncRoute =
    (handler: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      void handler(req, res).catch(next);
    };

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", mqtt: getStatus(), broker: config.mqttUrl, topic: config.mqttTopic });
  });

  router.get(
    "/snapshot",
    asyncRoute(async (_req, res) => {
      res.json(await store.snapshot());
    }),
  );

  router.get(
    "/metrics",
    asyncRoute(async (req, res) => {
      const context = resolveShift(Date.now());
      const date = typeof req.query.date === "string" ? req.query.date : context.date;
      const rawShift = req.query.shift;
      const shift: ShiftId | "all" = rawShift === "1" ? 1 : rawShift === "2" ? 2 : "all";

      res.json({
        date,
        shift,
        metrics: await store.metrics(date, shift),
        cycles: await store.cyclesFor(date, shift),
      });
    }),
  );

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] request failed:", error);
    res.status(500).json({ error: "Internal server error" });
  });

  return router;
}
