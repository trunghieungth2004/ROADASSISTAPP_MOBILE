import type {RouteStep} from "../api/routes";

export const SYNTH_MIN_TURN_DEG = 15;
export const SYNTH_MERGE_DIST_M = 40;
export const SYNTH_MIN_RUN_M = 10;

const wrapDeg = (d: number): number => ((d + 540) % 360) - 180;

const bearing = (a: [number, number], b: [number, number]): number => {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const segmentMeters = (a: [number, number], b: [number, number]): number => {
  const r = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * r * Math.asin(Math.sqrt(s));
};

const classify = (delta: number): string => {
  const abs = Math.abs(delta);
  const side = delta > 0 ? "right" : "left";
  if (abs >= 165) return "uturn";
  if (abs >= 135) return `sharp-${side}`;
  if (abs >= 45) return `turn-${side}`;
  return `slight-${side}`;
};

export function synthesizeManeuvers(coords: [number, number][]): RouteStep[] {
  const out: RouteStep[] = [];
  if (coords.length === 0) return out;
  const first = coords[0];
  out.push({at: [first[0], first[1]], kind: "start", distMeters: 0, durationSec: 0});
  if (coords.length < 3) {
    const last = coords[coords.length - 1];
    if (coords.length === 2) {
      out.push({at: [last[0], last[1]], kind: "destination", distMeters: 0, durationSec: 0});
    }
    return out;
  }
  const bearings: number[] = [];
  const lengths: number[] = [];
  for (let i = 0; i + 1 < coords.length; i++) {
    const len = segmentMeters(coords[i], coords[i + 1]);
    if (len < 0.5) {
      bearings.push(NaN);
      lengths.push(0);
      continue;
    }
    bearings.push(bearing(coords[i], coords[i + 1]));
    lengths.push(len);
  }
  let pendingDelta = 0;
  let pendingAt = 0;
  let pendingRun = 0;
  const flush = (): void => {
    if (Math.abs(pendingDelta) >= SYNTH_MIN_TURN_DEG && pendingRun >= SYNTH_MIN_RUN_M) {
      const p = coords[pendingAt];
      out.push({at: [p[0], p[1]], kind: classify(pendingDelta), distMeters: 0, durationSec: 0});
    }
    pendingDelta = 0;
    pendingRun = 0;
  };
  for (let i = 1; i + 1 < coords.length; i++) {
    const prev = bearings[i - 1];
    const next = bearings[i];
    if (Number.isNaN(prev) || Number.isNaN(next)) {
      flush();
      continue;
    }
    const d = wrapDeg(next - prev);
    const run = lengths[i - 1] + lengths[i];
    if (Math.abs(d) < SYNTH_MIN_TURN_DEG) {
      pendingRun += lengths[i];
      if (pendingRun >= SYNTH_MERGE_DIST_M && pendingDelta !== 0) flush();
      continue;
    }
    if (pendingDelta !== 0 && Math.sign(d) !== Math.sign(pendingDelta)) flush();
    if (pendingDelta === 0) pendingAt = i;
    pendingDelta += d;
    pendingRun += run;
    if (pendingRun >= SYNTH_MERGE_DIST_M) flush();
  }
  flush();
  const last = coords[coords.length - 1];
  out.push({at: [last[0], last[1]], kind: "destination", distMeters: 0, durationSec: 0});
  return out;
}

export function maneuverSteps(route: {steps?: RouteStep[]; geometry: {coordinates: [number, number][]}}): RouteStep[] {
  if (route.steps && route.steps.length > 0) return route.steps;
  return synthesizeManeuvers(route.geometry.coordinates);
}
