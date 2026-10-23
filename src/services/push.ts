import {Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {registerPush, unregisterPush} from "../api/push";
import {parseDispatchPush, parseHazardPush, parsePaymentPush, type DispatchPushData, type HazardPushData, type PaymentPushData} from "./pushPayload";

export type {DispatchPushData, HazardPushData, PaymentPushData};

const DEVICE_KEY = "roadassist.push.device";
const OWNER_KEY = "roadassist.push.owner";
const LAST_PUSH_KEY = "roadassist.push.last";
const LAST_DISPATCH_PUSH_KEY = "roadassist.push.lastDispatch";
const CLAIM_TTL_MS = 120000;

const DISPATCH_CHANNEL = "dispatch";
const URGENT_DISPATCH_CHANNEL = "dispatch-urgent";
const PAYMENT_CHANNEL = "payments";

let configured = false;
let configuring: Promise<void> | null = null;
let registrationInFlight: Promise<boolean> | null = null;
let registrationInFlightKey: string | null = null;
let lastDeviceToken: string | null = null;
let permissionPrompted = false;
let registrationQueue: Promise<unknown> = Promise.resolve();
const claimed = new Map<string, number>();
let navForeground = false;

export function setNavForeground(open: boolean): void {
  navForeground = open;
}

export function claimPush(id: string, status?: string, owner?: string): boolean {
  void owner;
  const key = `${id}:${status ?? "-"}`;
  const now = Date.now();
  const at = claimed.get(key);
  if (at !== undefined && now - at < CLAIM_TTL_MS) return false;
  claimed.set(key, now);
  for (const [k, ts] of claimed) {
    if (now - ts >= CLAIM_TTL_MS) claimed.delete(k);
  }
  return true;
}

export function ensurePushConfigured(): Promise<void> {
  if (configured) return Promise.resolve();
  if (configuring) return configuring;
  navForeground = false;
  configuring = (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async (req) => {
        const urgent = parseDispatchPush(req.request.content.data)?.urgent === true;
        const quiet = navForeground && !urgent;
        return quiet
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
            };
      },
    });
    if (Platform.OS === "android") {
      await Promise.all([
        Notifications.setNotificationChannelAsync("hazard", {
          name: "Hazards",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        }),
        Notifications.setNotificationChannelAsync(DISPATCH_CHANNEL, {
          name: "Dispatch",
          importance: Notifications.AndroidImportance.DEFAULT,
        }),
        Notifications.setNotificationChannelAsync(URGENT_DISPATCH_CHANNEL, {
          name: "Dispatch (urgent)",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        }),
        Notifications.setNotificationChannelAsync(PAYMENT_CHANNEL, {
          name: "Payments",
          importance: Notifications.AndroidImportance.DEFAULT,
        }),
      ]);
    }
    configured = true;
  })().catch(() => undefined).finally(() => {
    configuring = null;
  });
  return configuring;
}

async function ensureNotificationPermission(): Promise<void> {
  if (permissionPrompted) return;
  permissionPrompted = true;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain) {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    return;
  }
}

export async function syncPushToken(authToken: string | null, uid: string | null): Promise<boolean> {
  if (!authToken || !uid || Platform.OS === "web") return false;
  const key = `${uid}:${authToken}`;
  if (registrationInFlight && registrationInFlightKey === key) {
    return registrationInFlight;
  }
  const run = async (): Promise<boolean> => {
    try {
      await ensurePushConfigured();
      await ensureNotificationPermission();
      const device = (await Notifications.getDevicePushTokenAsync()).data ?? "";
      if (device === "") return false;
      lastDeviceToken = device;
      await registerPush(authToken, device);
      try {
        await AsyncStorage.multiSet([
          [DEVICE_KEY, device],
          [OWNER_KEY, uid],
        ]);
      } catch {
        return true;
      }
      return true;
    } catch {
      return false;
    }
  };
  const next = registrationQueue.then(run, run);
  registrationQueue = next.catch(() => undefined);
  const tracked = next.finally(() => {
    if (registrationInFlight === tracked) {
      registrationInFlight = null;
      registrationInFlightKey = null;
    }
  });
  registrationInFlight = tracked;
  registrationInFlightKey = key;
  return tracked;
}

export async function syncPushTokenWithRetry(
  authToken: string | null,
  uid: string | null,
  attempts = 6,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!authToken || !uid || Platform.OS === "web") return false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) return false;
    if (await syncPushToken(authToken, uid)) return true;
    if (signal?.aborted) return false;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  return false;
}

export function subscribePushTokenRefresh(
  authToken: string | null,
  uid: string | null,
): () => void {
  if (!authToken || !uid || Platform.OS === "web") return () => undefined;
  const sub = Notifications.addPushTokenListener((token) => {
    const device = typeof token?.data === "string" ? token.data : "";
    if (device !== "" && device === lastDeviceToken) return;
    void syncPushToken(authToken, uid);
  });
  return () => {
    sub.remove();
  };
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
    if (parsed && claimPush(parsed.flagId, parsed.status, owner)) {
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

export function subscribePaymentPush(onPush: (data: PaymentPushData) => void, owner: string): () => void {
  const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
    const parsed = parsePaymentPush(r.notification.request.content.data);
    if (!parsed) return;
    const key = `${parsed.event}:${parsed.paymentId}:${parsed.payoutId ?? ""}`;
    if (claimPush(key, undefined, owner)) onPush(parsed);
  });
  return () => {
    tapped.remove();
  };
}

export function subscribeDispatchPush(onPush: (data: DispatchPushData) => void, owner: string): () => void {
  const fromNotification = (n: Notifications.Notification | null | undefined): void => {
    if (!n) return;
    const parsed = parseDispatchPush(n.request.content.data);
    if (!parsed) return;
    void AsyncStorage.setItem(LAST_DISPATCH_PUSH_KEY, JSON.stringify({ticketId: parsed.ticketId, status: parsed.status ?? "", at: Date.now()})).catch(() => undefined);
    if (claimPush(parsed.ticketId, parsed.status, owner)) {
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

export async function getLastDispatchPush(): Promise<{ticketId: string; status: string; at: number} | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_DISPATCH_PUSH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {ticketId: string; status: string; at: number};
    if (typeof parsed.ticketId !== "string" || typeof parsed.at !== "number") return null;
    return {ticketId: parsed.ticketId, status: typeof parsed.status === "string" ? parsed.status : "", at: parsed.at};
  } catch {
    return null;
  }
}

let drainedDispatchLaunch: string | null = null;
let drainedHazardLaunch: string | null = null;
let drainedPaymentLaunch: string | null = null;

function launchKey(data: {ticketId?: string; flagId?: string}, at: number | undefined): string | null {
  const id = data.ticketId ?? data.flagId;
  if (!id || at === undefined) return null;
  return `${id}:${at}`;
}

export async function drainDispatchLaunch(): Promise<DispatchPushData | null> {
  try {
    const res = await Notifications.getLastNotificationResponseAsync();
    const at = res?.notification.date;
    const parsed = parseDispatchPush(res?.notification.request.content.data);
    if (!parsed) return null;
    const key = launchKey(parsed, at);
    if (key === null || drainedDispatchLaunch === key) return null;
    drainedDispatchLaunch = key;
    return parsed;
  } catch {
    return null;
  }
}

export async function drainHazardLaunch(): Promise<HazardPushData | null> {
  try {
    const res = await Notifications.getLastNotificationResponseAsync();
    const at = res?.notification.date;
    const parsed = parseHazardPush(res?.notification.request.content.data);
    if (!parsed) return null;
    const key = launchKey(parsed, at);
    if (key === null || drainedHazardLaunch === key) return null;
    drainedHazardLaunch = key;
    return parsed;
  } catch {
    return null;
  }
}

export async function drainPaymentLaunch(): Promise<PaymentPushData | null> {
  try {
    const res = await Notifications.getLastNotificationResponseAsync();
    const at = res?.notification.date;
    if (at === undefined) return null;
    const parsed = parsePaymentPush(res?.notification.request.content.data);
    if (!parsed) return null;
    const claimKey = `${parsed.event}:${parsed.paymentId}:${parsed.payoutId ?? ""}`;
    const launchKey = `${claimKey}:${at}`;
    if (drainedPaymentLaunch === launchKey) return null;
    drainedPaymentLaunch = launchKey;
    return claimPush(claimKey) ? parsed : null;
  } catch {
    return null;
  }
}

export async function probeDeviceToken(): Promise<{token: string | null; error: string | null}> {
  try {
    await ensurePushConfigured();
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
