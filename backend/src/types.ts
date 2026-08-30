export type ShiftId = 1 | 2;

export type EventName = "pieceProduced";

export interface CycleRecord {
  id: string;
  date: string;
  time: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  shift: ShiftId;
  above: boolean;
}

export interface PieceRecord {
  id: string;
  date: string;
  time: string;
  ts: number;
  shift: ShiftId;
}

export interface ShiftContext {
  shift: ShiftId;
  date: string;
  active: boolean;
}
