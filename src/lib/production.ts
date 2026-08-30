import type { CycleRecord, Metrics, PieceRecord, ShiftContext, ShiftId } from "@/types/production";

export const TARGET_TIME = 7.5;

export const SHIFTS: Record<
  ShiftId,
  { label: string; window: string; startHour: number; endHour: number }
> = {
  1: { label: "Turno 1", window: "06:00 — 13:59:59", startHour: 6, endHour: 14 },
  2: { label: "Turno 2", window: "14:00 — 21:59:59", startHour: 14, endHour: 22 },
};

const pad = (value: number) => String(value).padStart(2, "0");

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDateLabel(key: string): string {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Resolves the production shift for a timestamp. Between 22:00 and 05:59 the
 * plant is idle, so the context rolls forward to shift 1 of the next work day.
 */
export function resolveShift(input: Date | number): ShiftContext {
  const date = typeof input === "number" ? new Date(input) : input;
  const hour = date.getHours();

  if (hour >= SHIFTS[1].startHour && hour < SHIFTS[1].endHour) {
    return { shift: 1, date: formatDateKey(date), active: true, ...pickMeta(1) };
  }
  if (hour >= SHIFTS[2].startHour && hour < SHIFTS[2].endHour) {
    return { shift: 2, date: formatDateKey(date), active: true, ...pickMeta(2) };
  }

  const rollover = new Date(date);
  if (hour >= SHIFTS[2].endHour) rollover.setDate(rollover.getDate() + 1);
  return { shift: 1, date: formatDateKey(rollover), active: false, ...pickMeta(1) };
}

function pickMeta(shift: ShiftId) {
  return { label: SHIFTS[shift].label, window: SHIFTS[shift].window };
}

export function formatSeconds(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "—";
  return `${value.toFixed(digits)} s`;
}

export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function getShiftWindow(date: string, shift: ShiftId) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const base = new Date(year, month - 1, day);

  if (shift === 1) {
    return {
      start: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 6, 0, 0).getTime(),
      end: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 14, 0, 0).getTime(),
    };
  }

  return {
    start: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 14, 0, 0).getTime(),
    end: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 22, 0, 0).getTime(),
  };
}

export function shiftElapsedSeconds(date: string, shift: ShiftId, reference = Date.now()) {
  const { start, end } = getShiftWindow(date, shift);
  if (reference <= start) return 0;
  return Math.max(0, Math.min(reference, end) - start) / 1000;
}

export function computeProductionTime(cycles: CycleRecord[], liveCycleTime = 0) {
  const cycleTime = cycles.reduce((sum, cycle) => sum + cycle.duration, 0);
  return cycleTime + liveCycleTime;
}

export function computeShiftIdleTime(
  cycles: CycleRecord[],
  date: string,
  shift: ShiftId,
  liveCycleTime = 0,
  reference = Date.now(),
) {
  const productionTime = computeProductionTime(cycles, liveCycleTime);
  const elapsed = shiftElapsedSeconds(date, shift, reference);
  return Math.max(0, elapsed - productionTime);
}

export function computeMetrics(cycles: CycleRecord[], pieces: PieceRecord[]): Metrics {
  const durations = cycles.map((cycle) => cycle.duration);
  const above = cycles.filter((cycle) => cycle.above).length;
  const lastCycle = cycles.reduce<null | CycleRecord>((latest, cycle) => {
    if (!latest || cycle.endedAt > latest.endedAt) return cycle;
    return latest;
  }, null);

  return {
    produced: pieces.length,
    cycles: cycles.length,
    average: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : 0,
    max: durations.length ? Math.max(...durations) : 0,
    min: durations.length ? Math.min(...durations) : 0,
    last: lastCycle ? lastCycle.duration : 0,
    above,
    abovePercent: cycles.length ? (above / cycles.length) * 100 : 0,
  };
}
