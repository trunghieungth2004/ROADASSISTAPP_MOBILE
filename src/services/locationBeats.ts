import {useEffect, useRef} from "react";
import * as Location from "expo-location";

export async function capturePosition(): Promise<{lat: number; lng: number} | null> {
  try {
    const {status} = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({});
    return {lat: pos.coords.latitude, lng: pos.coords.longitude};
  } catch {
    return null;
  }
}

export function useLocationBeat(
  enabled: boolean,
  intervalMs: number,
  onBeat: () => Promise<void>,
): void {
  const ref = useRef(onBeat);
  ref.current = onBeat;
  useEffect(() => {
    if (!enabled) return;
    void ref.current().catch(() => undefined);
    const timer = setInterval(() => {
      void ref.current().catch(() => undefined);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
}
