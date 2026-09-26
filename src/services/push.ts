import {Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {registerPush, unregisterPush} from "../api/push";

export type HazardPushData = {
  flagId: string;
  type?: string;
  status?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  removed?: boolean;
};

const DEVICE_KEY = "roadassist.push.device";
const OWNER_KEY = "roadassist.push.owner";
const LAST_PUSH_KEY = "roadassist.push.last";
const CLAIM_TTL_MS = 120000;

let configured = false;
const claimed = new Map<string, number>();
let navForeground = false;

export function setNavForeground(open: boolean): void {
  navForeground = open;
}

export function parseHazardPush(data: unknown): HazardPushData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.flagId !== "string" || d.flagId === "") return null;
  const num = (v: unknown): number | undefined => (typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    flagId: d.flagId,
    type: typeof d.type === "string" ? d.type : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
    lat: num(d.lat),
    lng: num(d.lng),
    radiusMeters: num(d.radiusMeters),
    removed: d.removed === true || d.removed === "true" || undefined,
  };
}

export function claimPush(flagId: string): boolean {
  const now = Date.now();
  const at = claimed.get(flagId);
  if (at !== undefined && now - at < CLAIM_TTL_MS) return false;
  claimed.set(flagId, now);
  for (const [id, ts] of claimed) {
    if (now - ts >= CLAIM_TTL_MS) claimed.delete(id);
  }
  return true;
}

export function ensurePushConfigured(): void {
  if (configured) return;
  configured = true;
  navForeground = false;
  Notifications.setNotificationHandler({
    handleNotification: async () =>
      navForeground
        ? {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }
        : {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          },
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("hazard", {
      name: "Hazards",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => undefined);
  }
}

export async function syncPushToken(authToken: string | null, uid: string | null): Promise<boolean> {
  if (!authToken || !uid || Platform.OS === "web") return false;
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return false;
    const device = (await Notifications.getDevicePushTokenAsync()).data ?? "";
    if (device === "") return false;
    const prev = await AsyncStorage.multiGet([DEVICE_KEY, OWNER_KEY]);
    if (prev[0][1] === device && prev[1][1] === uid) return true;
    await registerPush(authToken, device);
    await AsyncStorage.multiSet([
      [DEVICE_KEY, device],
      [OWNER_KEY, uid],
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function unsyncPushToken(authToken: string): Promise<void> {
  try {
    const device = await AsyncStorage.getItem(DEVICE_KEY);
    if (device) await unregisterPush(authToken, device).catch(() => undefined);
  } catch {}
  await AsyncStorage.multiRemove([DEVICE_KEY, OWNER_KEY]).catch(() => undefined);
}

export function subscribeHazardPush(onPush: (data: HazardPushData) => void, owner: string): () => void {
  const fromNotification = (n: Notifications.Notification | null | undefined): void => {
    if (!n) return;
    const parsed = parseHazardPush(n.request.content.data);
    if (parsed && claimPush(`${owner}:${parsed.flagId}`)) {
      console.log(`[push] received ${parsed.flagId.slice(0, 8)} removed=${parsed.removed === true}`);
      void AsyncStorage.setItem(LAST_PUSH_KEY, JSON.stringify({flagId: parsed.flagId, at: Date.now()})).catch(() => undefined);
      onPush(parsed);
    }
  };
  const received = Notifications.addNotificationReceivedListener(fromNotification);
  const tapped = Notifications.addNotificationResponseReceivedListener((r) => fromNotification(r.notification));
  return () => {
    received.remove();
    tapped.remove();
  };
}

export async function getLastPush(): Promise<{flagId: string; at: number} | null> {  try {
    const raw = await AsyncStorage.getItem(LAST_PUSH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {flagId: string; at: number};
    if (typeof parsed.flagId !== "string" || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function probeDeviceToken(): Promise<{token: string | null; error: string | null}> {
  try {
    const device = (await Notifications.getDevicePushTokenAsync()).data ?? "";
    if (device === "") return {token: null, error: "empty token"};
    return {token: device, error: null};
  } catch (err) {
    return {token: null, error: err instanceof Error ? err.message : String(err)};
  }
}

export async function notifyHazardHeadsUp(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({content: {title, body}, trigger: null});
  } catch {
    return;
  }
}
