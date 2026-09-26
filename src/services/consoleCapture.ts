type Level = "log" | "warn" | "error" | "debug";

export type CapturedLine = {
  at: number;
  level: Level;
  text: string;
};

const MAX_LINES = 500;

const originals: Record<Level, (...args: unknown[]) => void> = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: (console.debug ?? console.log).bind(console),
};

let recording = false;
let buffer: CapturedLine[] = [];
const listeners = new Set<(lines: CapturedLine[]) => void>();

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  try {
    const encoded = JSON.stringify(arg);
    return encoded ?? String(arg);
  } catch {
    return String(arg);
  }
}

function emit(level: Level, args: unknown[]): void {
  if (!recording) return;
  buffer = [...buffer.slice(-(MAX_LINES - 1)), {at: Date.now(), level, text: args.map(formatArg).join(" ")}];
  for (const cb of [...listeners]) {
    try {
      cb(buffer);
    } catch {}
  }
}

export function startRecording(): void {
  if (recording) return;
  recording = true;
  (console.log as (...args: unknown[]) => void) = (...args: unknown[]) => {
    originals.log(...args);
    emit("log", args);
  };
  (console.warn as (...args: unknown[]) => void) = (...args: unknown[]) => {
    originals.warn(...args);
    emit("warn", args);
  };
  (console.error as (...args: unknown[]) => void) = (...args: unknown[]) => {
    originals.error(...args);
    emit("error", args);
  };
  (console.debug as (...args: unknown[]) => void) = (...args: unknown[]) => {
    originals.debug(...args);
    emit("debug", args);
  };
}

export function stopRecording(): void {
  if (!recording) return;
  recording = false;
  console.log = originals.log as never;
  console.warn = originals.warn as never;
  console.error = originals.error as never;
  console.debug = originals.debug as never;
}

export function isRecording(): boolean {
  return recording;
}

export function getCaptured(): CapturedLine[] {
  return buffer;
}

export function clearCaptured(): void {
  buffer = [];
  for (const cb of [...listeners]) {
    try {
      cb(buffer);
    } catch {}
  }
}

export function subscribeCaptured(cb: (lines: CapturedLine[]) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
