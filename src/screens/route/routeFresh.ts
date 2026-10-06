export const ROUTE_STALE_MS = 25 * 60 * 1000;

export const ROUTE_RETOUCH_MS = 20 * 60 * 1000;

export const ROUTE_TOUCH_CAP_MS = 60 * 60 * 1000;

export function isRouteStale(checkedAtMs: number | null, nowMs: number): boolean {
  if (checkedAtMs === null) return true;
  return nowMs - checkedAtMs >= ROUTE_STALE_MS;
}

export function touchCapReached(windowStartMs: number | null, nowMs: number): boolean {
  if (windowStartMs === null) return false;
  return nowMs - windowStartMs >= ROUTE_TOUCH_CAP_MS;
}
