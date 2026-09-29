export type FlagAction = "confirm" | "deny" | "remove" | "locked";

export function flagActions(status: string, isOwn: boolean): FlagAction[] {
  if (status === "3") return isOwn ? ["locked"] : [];
  if (status === "1") return isOwn ? ["remove"] : ["confirm", "deny"];
  if (status === "2") return isOwn ? ["remove"] : [];
  return [];
}

export type UntilStrings = {expiresIn: string; expired: string};

export function joinMeta(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null && part !== "").join(" · ");
}
export function formatUntil(expiresMs: number | null | undefined, nowMs: number, s: UntilStrings): string | null {
  if (expiresMs === undefined || expiresMs === null) return null;
  const left = expiresMs - nowMs;
  if (left <= 0) return s.expired;
  const mins = Math.floor(left / 60000);
  if (mins < 60) return s.expiresIn.replace("{n}", `${mins}m`);
  const hours = Math.floor(mins / 60);
  if (hours < 48) return s.expiresIn.replace("{n}", `${hours}h`);
  return s.expiresIn.replace("{n}", `${Math.floor(hours / 24)}d`);
}
