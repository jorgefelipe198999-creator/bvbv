import type { ShiftContext, ShiftId } from "./types.js";

export const TARGET_TIME = 7.5;

const pad = (value: number) => String(value).padStart(2, "0");

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatTime = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/**
 * Shift 1: 06:00 - 13:59:59 | Shift 2: 14:00 - 21:59:59.
 * From 22:00 onward the context rolls to shift 1 of the next production day.
 */
export function resolveShift(input: Date | number): ShiftContext {
  const date = typeof input === "number" ? new Date(input) : input;
  const hour = date.getHours();

  if (hour >= 6 && hour < 14) return { shift: 1, date: formatDateKey(date), active: true };
  if (hour >= 14 && hour < 22) return { shift: 2, date: formatDateKey(date), active: true };

  const rollover = new Date(date);
  if (hour >= 22) rollover.setDate(rollover.getDate() + 1);
  return { shift: 1 as ShiftId, date: formatDateKey(rollover), active: false };
}
