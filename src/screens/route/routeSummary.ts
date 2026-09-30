import type {RouteOption} from "../../api/routes";

export function suggestRouteName(originText: string, destText: string): string {
  const origin = originText.trim();
  const dest = destText.trim();
  if (origin && dest) return `${origin} → ${dest}`;
  return origin || dest;
}

export function stopCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export type PillMeta = {hazards: number; best: boolean};

export function pillMeta(routes: RouteOption[], index: number): PillMeta {
  const counts = routes.map((r) => r.hazards?.length ?? 0);
  const best = counts.length > 0 ? Math.min(...counts) : 0;
  const hazards = counts[index] ?? 0;
  return {hazards, best: hazards === best};
}
