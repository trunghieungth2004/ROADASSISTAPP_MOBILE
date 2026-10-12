import {expect, jest, test} from "@jest/globals";
import {CHECK_DEFS} from "../../../src/services/diagnostics";
import {getLastDispatchPush, subscribeDispatchPush, subscribeHazardPush} from "../../../src/services/push";
import {clearApiCache} from "../../../src/services/cache";
import {bustTicketCaches, feedTickets} from "../../../src/api/dispatch";
import {bustFlagCaches, myFlags} from "../../../src/api/flags";

const realFetch = globalThis.fetch;

const mockStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiGet: async (keys: string[]) => keys.map((k) => [k, mockStore.get(k) ?? null]),
  multiSet: async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) mockStore.set(k, v);
  },
  multiRemove: async (keys: string[]) => {
    for (const k of keys) mockStore.delete(k);
  },
  getItem: async (key: string) => mockStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

let receivedHandler: ((n: unknown) => void) | null = null;

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn((fn: (n: unknown) => void) => {
    receivedHandler = fn;
    return {remove: jest.fn()};
  }),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  getPermissionsAsync: jest.fn(async () => ({granted: true, canAskAgain: false})),
  getDevicePushTokenAsync: jest.fn(async () => ({data: "fcm-token-abc"})),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "local-id"),
  AndroidImportance: {HIGH: 4},
}));

jest.mock("../../../src/api/push", () => ({
  registerPush: async () => ({userId: "u1", tokens: ["fcm-token-abc", "other"], updatedAt: "2026-01-01T00:00:00.000Z"}),
  unregisterPush: async () => ({removed: true}),
  pingPush: async () => ({tokens: 2, sent: 1, failed: 1, firstError: "SOME_ERROR"}),
}));

jest.mock("../../../src/services/permissions", () => ({
  getPermissionStates: async () => ({notifications: {granted: true, canAskAgain: false}, backgroundLocation: {granted: false, canAskAgain: true}}),
}));

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({granted: true})),
  getLastKnownPositionAsync: jest.fn(async () => null),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
}));

test("dispatch push receipt is recorded before dedup", async () => {
  mockStore.clear();
  const seen: unknown[] = [];
  const unsub = subscribeDispatchPush((data) => {
    seen.push(data);
  }, "owner1");
  try {
    const note = {request: {content: {data: {ticketId: "ticket-123", status: "2"}}}};
    receivedHandler?.(note);
    receivedHandler?.(note);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toHaveLength(1);
    const last = await getLastDispatchPush();
    expect(last?.ticketId).toBe("ticket-123");
    expect(last?.status).toBe("2");
  } finally {
    unsub();
  }
});

test("same-ticket new-status pushes pass the dedup", async () => {
  mockStore.clear();
  const seen: Array<{ticketId: string; status?: string}> = [];
  const unsub = subscribeDispatchPush((data) => {
    seen.push(data);
  }, "owner2");
  try {
    receivedHandler?.({request: {content: {data: {ticketId: "ticket-456", status: "1"}}}});
    receivedHandler?.({request: {content: {data: {ticketId: "ticket-456", status: "5"}}}});
    receivedHandler?.({request: {content: {data: {ticketId: "ticket-456", status: "5"}}}});
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen.map((d) => d.status)).toEqual(["1", "5"]);
  } finally {
    unsub();
  }
});

test("same-flag new-status pushes pass the dedup", async () => {
  mockStore.clear();
  const seen: Array<{flagId: string; status?: string}> = [];
  const unsub = subscribeHazardPush((data) => {
    seen.push(data);
  }, "owner3");
  try {
    receivedHandler?.({request: {content: {data: {flagId: "flag-9", status: "1"}}}});
    receivedHandler?.({request: {content: {data: {flagId: "flag-9", status: "2"}}}});
    receivedHandler?.({request: {content: {data: {flagId: "flag-9", status: "2"}}}});
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen.map((d) => d.status)).toEqual(["1", "2"]);
  } finally {
    unsub();
  }
});

test("ticket cache bust forces a feed refetch", async () => {
  let calls = 0;
  globalThis.fetch = (jest.fn(async () => {
    calls += 1;
    return {ok: true, status: 200, text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: []})} as Response;
  }) as unknown) as typeof fetch;
  try {
    await feedTickets(undefined, "tok");
    await feedTickets(undefined, "tok");
    expect(calls).toBe(1);
    bustTicketCaches("tok");
    await feedTickets(undefined, "tok");
    expect(calls).toBe(2);
  } finally {
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});

test("flag cache bust forces a mine refetch", async () => {
  let calls = 0;
  globalThis.fetch = (jest.fn(async () => {
    calls += 1;
    return {ok: true, status: 200, text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: []})} as Response;
  }) as unknown) as typeof fetch;
  try {
    await myFlags("tok");
    await myFlags("tok");
    expect(calls).toBe(1);
    bustFlagCaches("tok");
    await myFlags("tok");
    expect(calls).toBe(2);
  } finally {
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});

test("push diagnostics cover token kind, server echo, local path, round trip and dispatch history", async () => {
  mockStore.clear();
  mockStore.set("roadassist.push.lastDispatch", JSON.stringify({ticketId: "ticket-123", status: "2", at: Date.now()}));
  const byId = new Map(CHECK_DEFS.map((d) => [d.id, d]));
  for (const id of ["tokenKind", "serverToken", "localTest", "fcmRoundTrip", "lastDispatchPush"]) {
    expect(byId.has(id)).toBe(true);
  }
  const kind = await byId.get("tokenKind")?.run("tok");
  expect(kind?.ok).toBe(true);
  expect(kind?.detail).toBe("FCM");
  const server = await byId.get("serverToken")?.run("tok");
  expect(server?.ok).toBe(true);
  const local = await byId.get("localTest")?.run(null);
  expect(local?.ok).toBe(true);
  const round = await byId.get("fcmRoundTrip")?.run("tok");
  expect(round?.ok).toBe(true);
  expect(round?.detail).toContain("1/2");
  const last = await byId.get("lastDispatchPush")?.run(null);
  expect(last?.ok).toBe(true);
  const missing = await byId.get("fcmRoundTrip")?.run(null);
  expect(missing).toEqual({ok: false, detail: "NO_AUTH"});
});
