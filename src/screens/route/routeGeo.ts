export const fmtDist = (n: number) => n.toFixed(n < 10 ? 1 : 0);
export function vehicleIcon(type?: string): "motorbike" | "car" | "van-utility" | "truck" {
  if (type === "CAR") return "car";
  if (type === "VAN") return "van-utility";
  if (type === "TRUCK") return "truck";
  return "motorbike";
}
export function boundsOf(coords: [number, number][]): {ne: [number, number]; sw: [number, number]} | null {
  if (coords.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return {ne: [maxLng, maxLat], sw: [minLng, minLat]};
}
export function midOf(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  return coords[Math.floor(coords.length / 2)] ?? null;
}
export function pillPointAbove(mid: [number, number], zoom: number, liftPx: number): [number, number] {
  const mpp = (156543.03392 * Math.cos((mid[1] * Math.PI) / 180)) / Math.pow(2, zoom);
  return [mid[0], mid[1] + (liftPx * mpp) / 111320];
}
export function pointFeature(lng: number, lat: number) {
  return {type: "Feature" as const, geometry: {type: "Point" as const, coordinates: [lng, lat] as [number, number]}, properties: {}};
}
