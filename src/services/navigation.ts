export type RouteProgress = {
  progressMeters: number;
  remainingMeters: number;
  totalMeters: number;
  distToRoute: number;
  segIndex: number;
  point: [number, number];
};

export const OFF_ROUTE_METERS = 50;
export const OFF_ROUTE_FIXES = 3;
export const ARRIVAL_METERS = 30;
export const HAZARD_ALERT_METERS = 300;
export const ANNOUNCE_NEAR_METERS = 200;
export const ANNOUNCE_CLOSE_METERS = 50;

const toRad = (d: number): number => (d * Math.PI) / 180;

export function routeLengths(coords: [number, number][]): {cum: number[]; total: number} {
  const cum: number[] = [0];
  for (let i = 0; i + 1 < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const x = toRad(lng2 - lng1) * Math.cos(toRad((lat1 + lat2) / 2));
    const y = toRad(lat2 - lat1);
    cum.push(cum[i] + Math.sqrt(x * x + y * y) * 6371000);
  }
  return {cum, total: cum[cum.length - 1] ?? 0};
}

export function windowAround(coords: [number, number][], centerM: number, halfM: number): [number, number][] {
  if (coords.length < 2 || halfM <= 0) return [];
  const {cum, total} = routeLengths(coords);
  const startM = Math.max(0, centerM - halfM);
  const endM = Math.min(total, centerM + halfM);
  const at = (m: number): [number, number] => {
    let i = 0;
    while (i + 1 < cum.length - 1 && cum[i + 1] < m) i++;
    const segLen = cum[i + 1] - cum[i];
    const t = segLen <= 0 ? 0 : Math.min(1, Math.max(0, (m - cum[i]) / segLen));
    const a = coords[i];
    const b = coords[i + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const out: [number, number][] = [at(startM)];
  for (let i = 0; i < coords.length; i++) {
    if (cum[i] > startM && cum[i] < endM) out.push(coords[i]);
  }
  out.push(at(endM));
  return out;
}

export function projectOntoRoute(lat: number, lng: number, coords: [number, number][]): RouteProgress {
  const {cum, total} = routeLengths(coords);
  if (coords.length < 2) {
    const fallback: [number, number] = coords.length === 1 ? [coords[0][0], coords[0][1]] : [lng, lat];
    return {progressMeters: 0, remainingMeters: total, totalMeters: total, distToRoute: Number.POSITIVE_INFINITY, segIndex: 0, point: fallback};
  }
  const kx = Math.cos(toRad(lat));
  let best = {d2: Number.POSITIVE_INFINITY, along: 0, seg: 0, cx: 0, cy: 0};
  for (let i = 0; i + 1 < coords.length; i++) {
    const ax = coords[i][0] * kx;
    const ay = coords[i][1];
    const bx = coords[i + 1][0] * kx;
    const by = coords[i + 1][1];
    const px = lng * kx;
    const py = lat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dLat = (cy - py) * 111320;
    const dLng = (cx - px) * 111320;
    const d2 = dLat * dLat + dLng * dLng;
    if (d2 < best.d2) {
      best = {d2, along: cum[i] + t * (cum[i + 1] - cum[i]), seg: i, cx, cy};
    }
  }
  return {
    progressMeters: best.along,
    remainingMeters: Math.max(0, total - best.along),
    totalMeters: total,
    distToRoute: Math.sqrt(best.d2),
    segIndex: best.seg,
    point: [best.cx / kx, best.cy],
  };
}
