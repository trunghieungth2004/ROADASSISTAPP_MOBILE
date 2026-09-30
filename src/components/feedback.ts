export type FeedbackKind = "failure" | "success" | "neutral";

export type FeedbackSeverity = "error" | "confirm" | "info";

export function pickFeedback(kind: FeedbackKind): FeedbackSeverity {
  if (kind === "failure") return "error";
  if (kind === "success") return "confirm";
  return "info";
}

export function isStaleForRefresh(lastLoadedAtMs: number, nowMs: number, minIntervalMs = 2000): boolean {
  return nowMs - lastLoadedAtMs >= minIntervalMs;
}
