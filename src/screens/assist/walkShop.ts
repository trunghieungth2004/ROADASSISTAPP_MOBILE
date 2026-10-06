export const WALK_RADII = [500, 1000, 2000];

export const IM_HERE_RADIUS_M = 200;

export const WALK_METERS_PER_MINUTE = 83;

export function walkMinutes(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  return Math.max(1, Math.round(distanceMeters / WALK_METERS_PER_MINUTE));
}

export function walkKm(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return "0.0";
  return (distanceMeters / 1000).toFixed(1);
}

