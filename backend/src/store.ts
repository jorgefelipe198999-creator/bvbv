import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

import { getCollections } from "./db.js";
import { TARGET_TIME, formatTime, resolveShift } from "./shifts.js";
import type { CycleRecord, EventName, PieceRecord, ShiftId } from "./types.js";

interface Metrics {
  produced: number;
  cycles: number;
  average: number;
  max: number;
  min: number;
  last: number;
  above: number;
  abovePercent: number;
}

const MACHINE_STOP_TIMEOUT_MS = 15_000;

class ProductionStore extends EventEmitter {
  private runningSince: number | null = null;
  private lastEventAt: number | null = null;

  private eventQueue: Promise<void> = Promise.resolve();

  private get isMachineRunning() {
    return this.lastEventAt !== null && this.runningSince !== null && Date.now() - this.lastEventAt <= MACHINE_STOP_TIMEOUT_MS;
  }

  handleEvent(event: EventName, ts = Date.now()) {
    this.eventQueue = this.eventQueue
      .catch((error: unknown) => {
        console.error("[store] event processing failed; continuing queue:", error);
      })
      .then(() => this.processEvent(event, ts));
    return this.eventQueue;
  }

  private async processEvent(event: EventName, ts: number) {
    if (this.lastEventAt !== null && ts <= this.lastEventAt) return;

    const collections = await getCollections();
    const end = new Date(ts);
    const context = resolveShift(end);

    const duplicatePiece = await collections.pieces.findOne({ ts, date: context.date, shift: context.shift });
    if (duplicatePiece) {
      this.lastEventAt = ts;
      this.runningSince = ts;
      return;
    }

    const startedAt = this.runningSince;
    let cycle: CycleRecord | undefined;
    let piece: PieceRecord | undefined;
    if (startedAt !== null && ts > startedAt) {
      const duration = Number(((ts - startedAt) / 1000).toFixed(2));
      cycle = {
        id: randomUUID(),
        date: context.date,
        time: formatTime(end),
        startedAt,
        endedAt: ts,
        duration,
        shift: context.shift,
        above: duration > TARGET_TIME,
      };
      await collections.cycles.insertOne(cycle);
      piece = {
        id: randomUUID(),
        date: context.date,
        time: formatTime(end),
        ts,
        shift: context.shift,
      };
      await collections.pieces.insertOne(piece);
    }
    this.lastEventAt = ts;
    this.runningSince = ts;
    this.emit("change", { event, ts, cycle, piece });
  }

  async metrics(date: string, shift: ShiftId | "all"): Promise<Metrics> {
    const collections = await getCollections();
    const filter =
      shift === "all" ? { date, duration: { $gt: 0 } } : { date, shift, duration: { $gt: 0 } };
    const [summary, produced] = await Promise.all([
      collections.cycles
        .aggregate<{
          cycles: number;
          average: number;
          max: number;
          min: number;
          above: number;
          last: number;
        }>([
          { $match: filter },
          { $sort: { endedAt: -1 } },
          {
            $group: {
              _id: null,
              cycles: { $sum: 1 },
              average: { $avg: "$duration" },
              max: { $max: "$duration" },
              min: { $min: "$duration" },
              above: { $sum: { $cond: ["$above", 1, 0] } },
              last: { $first: "$duration" },
            },
          },
        ])
        .next(),
      collections.pieces.countDocuments(shift === "all" ? { date } : { date, shift }),
    ]);
    const cycles = summary?.cycles ?? 0;
    const above = summary?.above ?? 0;

    return {
      produced,
      cycles,
      average: summary?.average ?? 0,
      max: summary?.max ?? 0,
      min: summary?.min ?? 0,
      last: summary?.last ?? 0,
      above,
      abovePercent: cycles ? (above / cycles) * 100 : 0,
    };
  }

  async cyclesFor(date: string, shift: ShiftId | "all") {
    const collections = await getCollections();
    const filter =
      shift === "all" ? { date, duration: { $gt: 0 } } : { date, shift, duration: { $gt: 0 } };
    return collections.cycles.find(filter).sort({ endedAt: 1 }).toArray();
  }

  async snapshot() {
    const context = resolveShift(Date.now());
    const [shift1, shift2, current, availableDates, cycles, pieces] = await Promise.all([
      this.metrics(context.date, 1),
      this.metrics(context.date, 2),
      this.metrics(context.date, context.shift),
      this.availableDates(),
      this.allCycles(context.date),
      this.allPieces(context.date),
    ]);

    const runningSince = this.isMachineRunning ? this.runningSince : null;

    return {
      type: "snapshot" as const,
      currentShift: context,
      runningSince,
      lastEventAt: this.lastEventAt,
      liveCycleTime: runningSince ? (Date.now() - runningSince) / 1000 : 0,
      target: TARGET_TIME,
      metrics: {
        shift1,
        shift2,
        current,
      },
      cycles,
      pieces,
      availableDates,
    };
  }

  private async allCycles(date: string) {
    const collections = await getCollections();
    const cycles = await collections.cycles
      .find(
        { date, duration: { $gt: 0 } },
        {
          projection: {
            _id: 0,
            id: 1,
            date: 1,
            time: 1,
            startedAt: 1,
            endedAt: 1,
            duration: 1,
            shift: 1,
            above: 1,
          },
        },
      )
      .sort({ endedAt: -1 })
      .toArray();
    return cycles.reverse();
  }

  private async allPieces(date: string) {
    const collections = await getCollections();
    const pieces = await collections.pieces
      .find(
        { date },
        {
          projection: {
            _id: 0,
            id: 1,
            date: 1,
            time: 1,
            ts: 1,
            shift: 1,
          },
        },
      )
      .sort({ ts: -1 })
      .toArray();
    return pieces.reverse();
  }

  private async availableDates() {
    const collections = await getCollections();
    return collections.cycles.distinct("date");
  }
}

export const store = new ProductionStore();
