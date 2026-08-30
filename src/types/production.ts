export type ShiftId = 1 | 2;

export type ProductionEvent = {
  event: "pieceProduced";
  ts?: number;
  cycle?: CycleRecord;
  piece?: PieceRecord;
};

export interface CycleRecord {
  id: string;
  /** production date, format yyyy-MM-dd */
  date: string;
  /** local time HH:mm:ss of the cycle end */
  time: string;
  startedAt: number;
  endedAt: number;
  /** cycle duration in seconds */
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
  label: string;
  window: string;
}

export interface Metrics {
  produced: number;
  cycles: number;
  average: number;
  max: number;
  min: number;
  last: number;
  above: number;
  abovePercent: number;
}

export type ConnectionStatus = "connecting" | "online" | "offline";

export interface ProductionState {
  cycles: CycleRecord[];
  pieces: PieceRecord[];
  runningSince: number | null;
  status: ConnectionStatus;
  source: "websocket" | "simulator";
  broker: string;
  topic: string;
  lastEventAt: number | null;
  ready: boolean;
}
