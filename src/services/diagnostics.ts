import {API_URL} from "../api/client";
import {registerPush} from "../api/push";
import {flagsNear} from "../api/flags";
import {getLastPush, probeDeviceToken} from "./push";
import {getDuckHolds, getLastSound} from "./sound";
import {getPermissionStates} from "./permissions";
import {hasStartedLocationUpdatesAsync, getLastKnownPositionAsync, getForegroundPermissionsAsync} from "expo-location";
import {BG_NAV_TASK} from "./bgNav";

export type DiagTab = "push" | "location" | "audio" | "network";
export const ALL_DIAG_TABS: DiagTab[] = ["push", "location", "audio", "network"];

export type CheckStatus = "pending" | "running" | "pass" | "fail";

export type CheckDef = {
  id: string;
  tab: DiagTab;
  labelKey: string;
  run: (authToken: string | null) => Promise<{ok: boolean; detail: string}>;
};

const fmtTime = (at: number): string => new Date(at).toLocaleTimeString();

export const CHECK_DEFS: CheckDef[] = [
  {
    id: "apiUrl",
    tab: "network",
    labelKey: "diagApi",
    run: async () => ({ok: true, detail: API_URL}),
  },
  {
    id: "ping",
    tab: "network",
    labelKey: "diagPing",
    run: async (authToken) => {
      if (!authToken) return {ok: false, detail: "NO_AUTH"};
      const start = Date.now();
      try {
        await flagsNear(0, 0, 100, authToken);
        return {ok: true, detail: `${Date.now() - start} ms`};
      } catch (err) {
        return {ok: false, detail: err instanceof Error ? err.message : String(err)};
      }
    },
  },
  {
    id: "notifications",
    tab: "push",
    labelKey: "diagNotifications",
    run: async () => {
      const states = await getPermissionStates();
      return {ok: states.notifications.granted, detail: states.notifications.granted ? "ON" : "OFF"};
    },
  },
  {
    id: "deviceToken",
    tab: "push",
    labelKey: "diagToken",
    run: async () => {
      const probe = await probeDeviceToken();
      if (probe.token) return {ok: true, detail: `${probe.token.slice(0, 12)}…`};
      return {ok: false, detail: probe.error ?? "NONE"};
    },
  },
  {
    id: "registered",
    tab: "push",
    labelKey: "diagRegistered",
    run: async (authToken) => {
      const probe = await probeDeviceToken();
      if (!probe.token || !authToken) return {ok: false, detail: "NO_TOKEN"};
      try {
        await registerPush(authToken, probe.token);
        return {ok: true, detail: "ON"};
      } catch (err) {
        return {ok: false, detail: err instanceof Error ? err.message : String(err)};
      }
    },
  },
  {
    id: "lastPush",
    tab: "push",
    labelKey: "diagLastPush",
    run: async () => {
      const last = await getLastPush();
      if (!last) return {ok: false, detail: "NEVER"};
      return {ok: true, detail: `${last.flagId.slice(0, 8)}… · ${fmtTime(last.at)}`};
    },
  },
  {
    id: "foreground",
    tab: "location",
    labelKey: "diagForeground",
    run: async () => {
      try {
        const granted = (await getForegroundPermissionsAsync()).granted;
        return {ok: granted, detail: granted ? "ON" : "OFF"};
      } catch {
        return {ok: false, detail: "ERROR"};
      }
    },
  },
  {
    id: "background",
    tab: "location",
    labelKey: "permBackground",
    run: async () => {
      const states = await getPermissionStates();
      const granted = states.backgroundLocation.granted;
      return {ok: granted, detail: granted ? "ON" : "OFF"};
    },
  },
  {
    id: "lastFix",
    tab: "location",
    labelKey: "diagLastFix",
    run: async () => {
      try {
        const fix = await getLastKnownPositionAsync();
        if (!fix) return {ok: false, detail: "NEVER"};
        return {ok: true, detail: `${fix.coords.latitude.toFixed(5)}, ${fix.coords.longitude.toFixed(5)} · ${fmtTime(fix.timestamp)}`};
      } catch {
        return {ok: false, detail: "ERROR"};
      }
    },
  },
  {
    id: "bgTask",
    tab: "location",
    labelKey: "diagBgTask",
    run: async () => {
      try {
        const running = await hasStartedLocationUpdatesAsync(BG_NAV_TASK);
        return {ok: running, detail: running ? "ON" : "OFF"};
      } catch {
        return {ok: false, detail: "ERROR"};
      }
    },
  },
  {
    id: "duck",
    tab: "audio",
    labelKey: "diagDuck",
    run: async () => ({ok: getDuckHolds() === 0, detail: String(getDuckHolds())}),
  },
  {
    id: "lastSound",
    tab: "audio",
    labelKey: "diagLastSound",
    run: async () => {
      const last = getLastSound();
      if (!last) return {ok: false, detail: "NEVER"};
      return {ok: true, detail: `${last.name} · ${fmtTime(last.at)}`};
    },
  },
];

export type DiagnosticResult = {
  apiUrl: string;
  notificationsGranted: boolean;
  deviceToken: string | null;
  tokenError: string | null;
  registered: boolean | null;
  registerError: string | null;
  backgroundGranted: boolean;
  foregroundGranted: boolean;
  lastPush: {flagId: string; at: number} | null;
  lastFix: {lat: number; lng: number; at: number} | null;
  bgTaskRunning: boolean;
  duckHolds: number;
  lastSound: {name: string; at: number} | null;
  pingMs: number | null;
  pingError: string | null;
};

export type PushDiag = Pick<DiagnosticResult, "apiUrl" | "notificationsGranted" | "deviceToken" | "tokenError" | "registered" | "registerError" | "lastPush">;
export type LocationDiag = Pick<DiagnosticResult, "backgroundGranted" | "foregroundGranted" | "lastFix" | "bgTaskRunning">;
export type AudioDiag = Pick<DiagnosticResult, "duckHolds" | "lastSound">;
export type NetworkDiag = Pick<DiagnosticResult, "pingMs" | "pingError">;

export async function runPushChecks(authToken: string | null): Promise<PushDiag> {
  const states = await getPermissionStates();
  const probe = await probeDeviceToken();
  let registered: boolean | null = null;
  let registerError: string | null = null;
  if (probe.token && authToken) {
    try {
      await registerPush(authToken, probe.token);
      registered = true;
    } catch (err) {
      registered = false;
      registerError = err instanceof Error ? err.message : String(err);
    }
  }
  const lastPush = await getLastPush();
  return {
    apiUrl: API_URL,
    notificationsGranted: states.notifications.granted,
    deviceToken: probe.token,
    tokenError: probe.error,
    registered,
    registerError,
    lastPush,
  };
}

export async function runLocationChecks(): Promise<LocationDiag> {
  const states = await getPermissionStates();
  let foregroundGranted = false;
  try {
    foregroundGranted = (await getForegroundPermissionsAsync()).granted;
  } catch {}
  let lastFix: LocationDiag["lastFix"] = null;
  try {
    const fix = await getLastKnownPositionAsync();
    if (fix) lastFix = {lat: fix.coords.latitude, lng: fix.coords.longitude, at: fix.timestamp};
  } catch {}
  let bgTaskRunning = false;
  try {
    bgTaskRunning = await hasStartedLocationUpdatesAsync(BG_NAV_TASK);
  } catch {}
  return {
    backgroundGranted: states.backgroundLocation.granted,
    foregroundGranted,
    lastFix,
    bgTaskRunning,
  };
}

export async function runAudioChecks(): Promise<AudioDiag> {
  return {duckHolds: getDuckHolds(), lastSound: getLastSound()};
}

export async function runNetworkChecks(authToken: string | null): Promise<NetworkDiag> {
  if (!authToken) return {pingMs: null, pingError: null};
  const start = Date.now();
  try {
    await flagsNear(0, 0, 100, authToken);
    return {pingMs: Date.now() - start, pingError: null};
  } catch (err) {
    return {pingMs: null, pingError: err instanceof Error ? err.message : String(err)};
  }
}

export async function runSelected(authToken: string | null, tabs: DiagTab[]): Promise<Partial<DiagnosticResult>> {
  const out: Partial<DiagnosticResult> = {};
  if (tabs.includes("push")) Object.assign(out, await runPushChecks(authToken));
  if (tabs.includes("location")) Object.assign(out, await runLocationChecks());
  if (tabs.includes("audio")) Object.assign(out, await runAudioChecks());
  if (tabs.includes("network")) Object.assign(out, await runNetworkChecks(authToken));
  return out;
}

export async function runDiagnostics(authToken: string | null): Promise<DiagnosticResult> {
  const [push, location, audio, network] = await Promise.all([
    runPushChecks(authToken),
    runLocationChecks(),
    runAudioChecks(),
    runNetworkChecks(authToken),
  ]);
  return {...push, ...location, ...audio, ...network};
}
