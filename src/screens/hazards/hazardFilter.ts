import type {Flag, FlagType} from "../../api/flags";

export type HazardFilter = "ALL" | FlagType;

export const HAZARD_FILTERS: HazardFilter[] = ["ALL", "ACCIDENT", "FLOOD", "OBSTRUCTION"];

export type AgoStrings = {justNow: string; minAgo: string; hourAgo: string; dayAgo: string};

function timeOf(flag: Flag): number {
  if (!flag.createdAt) return 0;
  const at = Date.parse(flag.createdAt);
  return Number.isNaN(at) ? 0 : at;
}

export function filterFlags(flags: Flag[], filter: HazardFilter): Flag[] {
  const list = filter === "ALL" ? [...flags] : flags.filter((f) => f.type === filter);
  list.sort((a, b) => timeOf(b) - timeOf(a));
  return list;
}

export function timeAgoLabel(createdAt: string | undefined, nowMs: number, s: AgoStrings): string | null {
  if (!createdAt) return null;
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return null;
  const mins = Math.max(0, Math.floor((nowMs - at) / 60000));
  if (mins < 1) return s.justNow;
  if (mins < 60) return s.minAgo.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return s.hourAgo.replace("{n}", String(hours));
  return s.dayAgo.replace("{n}", String(Math.floor(hours / 24)));
}
