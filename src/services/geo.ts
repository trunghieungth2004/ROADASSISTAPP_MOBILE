import * as Location from "expo-location";

export type FixOptions = {
  accuracy?: Location.Accuracy;
  maxAgeMs?: number;
  requiredAccuracyMeters?: number;
  timeoutMs?: number;
  staleFallback?: boolean;
};

const DEFAULTS = {
  accuracy: Location.Accuracy.Balanced,
  maxAgeMs: 30000,
  requiredAccuracyMeters: 200,
  timeoutMs: 4000,
  staleFallback: true,
};

function pointOf(pos: {coords: {latitude: number; longitude: number}}): {lat: number; lng: number} {
  return {lat: pos.coords.latitude, lng: pos.coords.longitude};
}

export async function getFix(options?: FixOptions): Promise<{lat: number; lng: number}> {
  const {accuracy, maxAgeMs, requiredAccuracyMeters, timeoutMs, staleFallback} = {...DEFAULTS, ...options};
  const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesOn) throw new Error("Location unavailable");
  const cached = await Location.getLastKnownPositionAsync({maxAge: maxAgeMs, requiredAccuracy: requiredAccuracyMeters}).catch(() => null);
  if (cached) return pointOf(cached);
  const raced = await Promise.race([
    Location.getCurrentPositionAsync({accuracy}),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]).catch(() => null);
  if (raced) return pointOf(raced);
  if (staleFallback) {
    const late = await Location.getLastKnownPositionAsync().catch(() => null);
    if (late) return pointOf(late);
  }
  throw new Error("Location unavailable");
}
