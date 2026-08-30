import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createRealtimeSource } from "@/services/realtime";
import { TARGET_TIME, computeMetrics, formatTime, resolveShift } from "@/lib/production";
import type {
  ConnectionStatus,
  CycleRecord,
  Metrics,
  PieceRecord,
  ProductionEvent,
  ProductionState,
  ShiftContext,
  ShiftId,
} from "@/types/production";

export interface ProductionContextValue extends ProductionState {
  now: number;
  currentShift: ShiftContext;
  liveCycleTime: number;
  metricsFor: (date: string, shift: ShiftId | "all") => Metrics;
  cyclesFor: (date: string, shift: ShiftId | "all") => CycleRecord[];
  piecesFor: (date: string, shift: ShiftId | "all") => PieceRecord[];
  availableDates: string[];
  target: number;
}

export const ProductionContext = createContext<ProductionContextValue | null>(null);

const MACHINE_STOP_TIMEOUT_MS = 15_000;

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`;

const defaultApiBase = (() => {
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:4000/api`;
})();

const API_BASE = import.meta.env.VITE_API_URL ?? defaultApiBase;

function emptyMetrics(): Metrics {
  return {
    produced: 0,
    cycles: 0,
    average: 0,
    max: 0,
    min: 0,
    last: 0,
    above: 0,
    abovePercent: 0,
  };
}

function buildRecord(startedAt: number, endedAt: number): CycleRecord {
  const endDate = new Date(endedAt);
  const context = resolveShift(endDate);
  const duration = Number(((endedAt - startedAt) / 1000).toFixed(2));
  return {
    id: nextId("cycle"),
    date: context.date,
    time: formatTime(endDate),
    startedAt,
    endedAt,
    duration,
    shift: context.shift,
    above: duration > TARGET_TIME,
  };
}

function dedupeById<T extends { id: string }>(items: T[], next: T | undefined | null) {
  if (!next) return items;

  for (let i = 0; i < items.length; i += 1) {
    if (items[i].id === next.id) {
      return items;
    }
  }

  const copy = items.slice();
  copy.push(next);

  return copy;
}

function dedupeItems<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;

    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function applySnapshot(payload: {
  type?: string;
  currentShift?: ShiftContext;
  cycles?: CycleRecord[];
  pieces?: PieceRecord[];
  metrics?: {
    shift1?: Metrics;
    shift2?: Metrics;
    current?: Metrics;
  };
  availableDates?: string[];
  lastEventAt?: number | null;
  runningSince?: number | null;
}): ProductionState & { availableDates: string[] } {
  const cycles = dedupeItems(
    (payload.cycles ?? []).filter((cycle) => cycle.duration > 0 && cycle.endedAt > cycle.startedAt),
  );
  const pieces = dedupeItems(payload.pieces ?? []);
  const metrics = {
    shift1: payload.metrics?.shift1 ?? emptyMetrics(),
    shift2: payload.metrics?.shift2 ?? emptyMetrics(),
    current: payload.metrics?.current ?? emptyMetrics(),
  };

  const dates = new Set<string>();
  for (const cycle of cycles) {
    dates.add(cycle.date);
  }

  const availableDates =
    payload.availableDates !== undefined
      ? [...new Set([...payload.availableDates, ...dates])].sort((a, b) => b.localeCompare(a))
      : [...dates].sort((a, b) => b.localeCompare(a));

  return {
    cycles,
    pieces,
    metrics,
    runningSince: payload.runningSince ?? null,
    status: "online",
    source: "websocket",
    broker: "mongodb",
    topic: "producao/eventos",
    lastEventAt: payload.lastEventAt ?? null,
    ready: true,
    availableDates,
  };
}

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProductionState>({
    cycles: [],
    pieces: [],
    metrics: {
      shift1: emptyMetrics(),
      shift2: emptyMetrics(),
      current: emptyMetrics(),
    },
    runningSince: null,
    status: "connecting",
    source: "websocket",
    broker: "—",
    topic: "producao/eventos",
    lastEventAt: null,
    ready: false,
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const snapshotReadyRef = useRef(false);
  const pendingEventsRef = useRef<ProductionEvent[]>([]);
  const metricsCache = useRef<Map<string, Metrics>>(new Map());
  const availableDatesRef = useRef<Set<string>>(new Set());
  const cycleIndexRef = useRef<Map<string, Map<ShiftId | "all", CycleRecord[]>>>(new Map());
  const pieceIndexRef = useRef<Map<string, Map<ShiftId | "all", PieceRecord[]>>>(new Map());

  const buildIndex = useCallback(
    <T extends { id: string; date: string; shift: ShiftId }>(items: T[]) => {
      const index = new Map<string, Map<ShiftId | "all", T[]>>();

      for (const item of items) {
        const byShift = index.get(item.date) ?? new Map<ShiftId | "all", T[]>();
        const shiftList = byShift.get(item.shift) ?? [];
        const allList = byShift.get("all") ?? [];

        if (!shiftList.some((entry) => entry.id === item.id)) {
          shiftList.push(item);
        }

        if (!allList.some((entry) => entry.id === item.id)) {
          allList.push(item);
        }

        byShift.set(item.shift, shiftList);
        byShift.set("all", allList);
        index.set(item.date, byShift);
      }

      return index;
    },
    [],
  );

  const addAvailableDate = useCallback((date: string) => {
    if (availableDatesRef.current.has(date)) return;

    availableDatesRef.current.add(date);
    setAvailableDates([...availableDatesRef.current].sort((a, b) => b.localeCompare(a)));
  }, []);

  const addCycleToIndex = useCallback((cycle: CycleRecord) => {
    const byShift =
      cycleIndexRef.current.get(cycle.date) ?? new Map<ShiftId | "all", CycleRecord[]>();
    const shiftList = byShift.get(cycle.shift) ?? [];
    const allList = byShift.get("all") ?? [];

    if (!shiftList.some((entry) => entry.id === cycle.id)) {
      shiftList.push(cycle);
    }

    if (!allList.some((entry) => entry.id === cycle.id)) {
      allList.push(cycle);
    }

    byShift.set(cycle.shift, shiftList);
    byShift.set("all", allList);
    cycleIndexRef.current.set(cycle.date, byShift);
  }, []);

  const addPieceToIndex = useCallback((piece: PieceRecord) => {
    const byShift =
      pieceIndexRef.current.get(piece.date) ?? new Map<ShiftId | "all", PieceRecord[]>();
    const shiftList = byShift.get(piece.shift) ?? [];
    const allList = byShift.get("all") ?? [];

    if (!shiftList.some((entry) => entry.id === piece.id)) {
      shiftList.push(piece);
    }

    if (!allList.some((entry) => entry.id === piece.id)) {
      allList.push(piece);
    }

    byShift.set(piece.shift, shiftList);
    byShift.set("all", allList);
    pieceIndexRef.current.set(piece.date, byShift);
  }, []);

  const invalidateMetricsForDate = useCallback((date: string) => {
    const affectedKeys = Array.from(metricsCache.current.keys()).filter((key) =>
      key.startsWith(`${date}|`),
    );

    for (const key of affectedKeys) {
      metricsCache.current.delete(key);
    }
  }, []);

  const cyclesFor = useCallback(
    (date: string, shift: ShiftId | "all") => cycleIndexRef.current.get(date)?.get(shift) ?? [],
    [],
  );

  const piecesFor = useCallback(
    (date: string, shift: ShiftId | "all") => pieceIndexRef.current.get(date)?.get(shift) ?? [],
    [],
  );

  const getMetrics = useCallback(
    (date: string, shift: ShiftId | "all") => {
      const key = `${date}|${shift}`;
      const cached = metricsCache.current.get(key);
      if (cached) return cached;

      const value = computeMetrics(cyclesFor(date, shift), piecesFor(date, shift));
      metricsCache.current.set(key, value);
      return value;
    },
    [cyclesFor, piecesFor],
  );

  const handleEvent = useCallback(
    (incoming: ProductionEvent) => {
      if (!snapshotReadyRef.current) {
        pendingEventsRef.current.push(incoming);
        return;
      }

      const ts = incoming.ts ?? Date.now();
      const context = resolveShift(ts);

      if (!Number.isFinite(ts)) {
        return;
      }

      const startedAt = startedAtRef.current;
      const localCycle = startedAt !== null && ts > startedAt ? buildRecord(startedAt, ts) : null;
      const cycle = incoming.cycle ?? localCycle;
      const piece: PieceRecord | null =
        incoming.piece ??
        (cycle
          ? {
              id: nextId("piece"),
              date: context.date,
              time: formatTime(new Date(ts)),
              ts,
              shift: context.shift,
            }
          : null);

      addAvailableDate(context.date);
      if (cycle) addAvailableDate(cycle.date);
      if (piece) addAvailableDate(piece.date);

      const affectedDates = new Set<string>([context.date]);
      if (cycle) affectedDates.add(cycle.date);
      if (piece) affectedDates.add(piece.date);

      let accepted = false;

      setState((previous) => {
        if (previous.lastEventAt !== null && ts <= previous.lastEventAt) {
          return previous;
        }

        accepted = true;

        let nextCycles = previous.cycles;
        let nextPieces = previous.pieces;

        if (cycle) {
          nextCycles = dedupeById(previous.cycles, cycle);
        }

        if (piece) {
          nextPieces = dedupeById(previous.pieces, piece);
        }

        return {
          ...previous,
          runningSince: cycle ? ts : previous.runningSince,
          lastEventAt: ts,
          cycles: nextCycles,
          pieces: nextPieces,
        };
      });

      if (!accepted) {
        return;
      }

      if (cycle) {
        startedAtRef.current = ts;
      }

      for (const date of affectedDates) {
        invalidateMetricsForDate(date);
      }

      if (cycle) {
        addCycleToIndex(cycle);
      }

      if (piece) {
        addPieceToIndex(piece);
      }
    },
    [addAvailableDate, addCycleToIndex, addPieceToIndex, invalidateMetricsForDate],
  );

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const response = await fetch(`${API_BASE}/snapshot`);
        if (!response.ok) throw new Error(`snapshot request failed: ${response.status}`);

        const payload = (await response.json()) as {
          currentShift?: ShiftContext;
          cycles?: CycleRecord[];
          pieces?: PieceRecord[];
          availableDates?: string[];
          lastEventAt?: number | null;
          runningSince?: number | null;
        };

        const snapshot = applySnapshot(payload);
        metricsCache.current.clear();
        cycleIndexRef.current = buildIndex(snapshot.cycles);
        pieceIndexRef.current = buildIndex(snapshot.pieces);

        setState((previous) => ({
          ...previous,
          cycles: snapshot.cycles,
          pieces: snapshot.pieces,
          runningSince: snapshot.runningSince,
          lastEventAt: snapshot.lastEventAt,
          status: snapshot.status,
          source: snapshot.source,
          broker: snapshot.broker,
          topic: snapshot.topic,
          ready: true,
        }));

        startedAtRef.current = snapshot.runningSince;
        availableDatesRef.current = new Set(snapshot.availableDates);
        setAvailableDates(snapshot.availableDates);
        snapshotReadyRef.current = true;

        const pendingEvents = pendingEventsRef.current;
        pendingEventsRef.current = [];

        for (const event of pendingEvents) {
          handleEvent(event);
        }
      } catch {
        snapshotReadyRef.current = true;
        metricsCache.current.clear();

        const pendingEvents = pendingEventsRef.current;
        pendingEventsRef.current = [];

        for (const event of pendingEvents) {
          handleEvent(event);
        }

        setState((previous) => ({
          ...previous,
          status: "offline",
          source: "websocket",
          ready: false,
        }));
      }
    };

    void loadSnapshot();

    const dispose = createRealtimeSource({
      onEvent: handleEvent,
      onStatus: (info) =>
        setState((previous) => ({
          ...previous,
          status: info.status as ConnectionStatus,
          source: info.source,
          broker: info.broker ?? previous.broker,
          topic: info.topic ?? previous.topic,
        })),
    });

    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 2000);

    return () => {
      dispose();
      clearInterval(clock);
      snapshotReadyRef.current = false;
      pendingEventsRef.current = [];
      metricsCache.current.clear();
    };
  }, [buildIndex, handleEvent]);

  const value = useMemo<ProductionContextValue>(() => {
    const reference = now || Date.parse("2026-01-01T08:00:00");
    const currentShift = resolveShift(reference);
    const runningSince =
      state.runningSince !== null &&
      state.lastEventAt !== null &&
      now - state.lastEventAt <= MACHINE_STOP_TIMEOUT_MS
        ? state.runningSince
        : null;

    return {
      ...state,
      now,
      currentShift,
      runningSince,
      liveCycleTime: runningSince ? Math.max(0, (now - runningSince) / 1000) : 0,
      cyclesFor,
      piecesFor,
      metricsFor: getMetrics,
      availableDates,
      target: TARGET_TIME,
    };
  }, [
    state.cycles,
    state.pieces,
    state.metrics,
    state.runningSince,
    state.status,
    state.source,
    state.broker,
    state.topic,
    state.lastEventAt,
    state.ready,
    now,
    availableDates,
    cyclesFor,
    piecesFor,
    getMetrics,
  ]);

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}
