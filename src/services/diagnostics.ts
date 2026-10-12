import {API_URL} from "../api/client";
import {pingPush, registerPush} from "../api/push";
import {flagsNear} from "../api/flags";
import {getLastDispatchPush, getLastPush, notifyHazardHeadsUp, probeDeviceToken} from "./push";
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
    id: "tokenKind",
    tab: "push",
    labelKey: "diagTokenKind",
    run: async () => {
      const probe = await probeDeviceToken();
      if (!probe.token) return {ok: false, detail: probe.error ?? "NONE"};
      if (probe.token.startsWith("ExponentPushToken")) return {ok: false, detail: "EXPO"};
      return {ok: true, detail: "FCM"};
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
        const record = await registerPush(authToken, probe.token);
        const tokens = Array.isArray(record.tokens) ? record.tokens : [];
        const present = tokens.includes(probe.token);
        return {ok: present, detail: `${tokens.length} tokens · ${record.updatedAt}`};
      } catch (err) {
        return {ok: false, detail: err instanceof Error ? err.message : String(err)};
      }
    },
  },
  {
    id: "serverToken",
    tab: "push",
    labelKey: "diagServerToken",
    run: async (authToken) => {
      const probe = await probeDeviceToken();
      if (!probe.token || !authToken) return {ok: false, detail: "NO_TOKEN"};
      try {
        const record = await registerPush(authToken, probe.token);
        const tokens = Array.isArray(record.tokens) ? record.tokens : [];
        const present = tokens.includes(probe.token);
        return {ok: present, detail: present ? `${tokens.length} tokens` : "MISSING"};
      } catch (err) {
        return {ok: false, detail: err instanceof Error ? err.message : String(err)};
      }
    },
  },
  {
    id: "localTest",
    tab: "push",
    labelKey: "diagLocalTest",
    run: async () => {
      const states = await getPermissionStates();
      if (!states.notifications.granted) return {ok: false, detail: "OFF"};
      try {
        await notifyHazardHeadsUp("RoadAssist test", "Local notification path");
        return {ok: true, detail: "SENT"};
      } catch (err) {
        return {ok: false, detail: err instanceof Error ? err.message : String(err)};
      }
    },
  },
  {
    id: "fcmRoundTrip",
    tab: "push",
    labelKey: "diagFcmRoundTrip",
    run: async (authToken) => {
      if (!authToken) return {ok: false, detail: "NO_AUTH"};
      try {
        const result = await pingPush(authToken);
        const detail = `${result.sent}/${result.tokens} sent${result.firstError ? ` · ${result.firstError}` : ""}`;
        return {ok: result.sent > 0, detail};
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
    id: "lastDispatchPush",
    tab: "push",
    labelKey: "diagLastDispatchPush",
    run: async () => {
      const last = await getLastDispatchPush();
      if (!last) return {ok: false, detail: "NEVER"};
      const ticket = last.ticketId.slice(0, 8);
      const status = last.status !== "" ? ` · ${last.status}` : "";
      return {ok: true, detail: `${ticket}…${status} · ${fmtTime(last.at)}`};
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
