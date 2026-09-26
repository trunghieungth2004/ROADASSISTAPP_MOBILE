import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const BG_NAV_TASK = "roadassist-bg-nav";
export const BG_FIX_KEY = "roadassist.bg.fix";

export type BgFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  ts: number;
};

TaskManager.defineTask(BG_NAV_TASK, async ({data, error}) => {
  if (error) return;
  const locations = (data as {locations?: Location.LocationObject[]}).locations;
  const last = locations?.[locations.length - 1];
  if (!last) return;
  const fix: BgFix = {
    lat: last.coords.latitude,
    lng: last.coords.longitude,
    accuracy: last.coords.accuracy,
    speed: last.coords.speed,
    ts: last.timestamp,
  };
  void AsyncStorage.setItem(BG_FIX_KEY, JSON.stringify(fix)).catch(() => undefined);
});

export async function startBgNav(title: string, body: string): Promise<boolean> {
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== "granted") return false;
    const started = await Location.hasStartedLocationUpdatesAsync(BG_NAV_TASK).catch(() => false);
    if (!started) {
      await Location.startLocationUpdatesAsync(BG_NAV_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: title,
          notificationBody: body,
          notificationColor: "#2563eb",
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function stopBgNav(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_NAV_TASK).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(BG_NAV_TASK);
  } catch {
    return;
  }
  await AsyncStorage.removeItem(BG_FIX_KEY).catch(() => undefined);
}

export async function readBgFix(): Promise<BgFix | null> {
  try {
    const raw = await AsyncStorage.getItem(BG_FIX_KEY);
    if (!raw) return null;
    const fix = JSON.parse(raw) as BgFix;
    if (typeof fix.lat !== "number" || typeof fix.lng !== "number" || typeof fix.ts !== "number") return null;
    return fix;
  } catch {
    return null;
  }
}
