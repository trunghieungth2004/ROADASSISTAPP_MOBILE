import {expect, jest, test} from "@jest/globals";
import {drainDispatchLaunch, drainHazardLaunch, syncPushToken} from "../../../src/services/push";

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

const mockRegister = jest.fn(async () => undefined);
let mockLastResponse: unknown = null;

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  getPermissionsAsync: jest.fn(async () => ({granted: false, canAskAgain: false})),
  getDevicePushTokenAsync: jest.fn(async () => ({data: "dev1"})),
  getLastNotificationResponseAsync: jest.fn(async () => mockLastResponse),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
}));

jest.mock("../../../src/api/push", () => ({
  registerPush: (...args: unknown[]) => (mockRegister as (...a: unknown[]) => Promise<void>)(...args),
  unregisterPush: async () => ({removed: true}),
}));

function responseFor(data: unknown, date: number) {
  return {notification: {date, request: {content: {data}}}};
}

test("token registers without notification permission", async () => {
  mockStore.clear();
  mockRegister.mockClear();
  await expect(syncPushToken("tok", "u1")).resolves.toBe(true);
  expect(mockRegister).toHaveBeenCalledWith("tok", "dev1");
});

test("dispatch launch drains once per tap", async () => {
  mockLastResponse = responseFor({ticketId: "t1", ticketType: "WALK_IN", status: "1"}, 111);
  await expect(drainDispatchLaunch()).resolves.toMatchObject({ticketId: "t1", ticketType: "WALK_IN"});
  await expect(drainDispatchLaunch()).resolves.toBeNull();
  mockLastResponse = null;
  await expect(drainDispatchLaunch()).resolves.toBeNull();
});

test("hazard launch parses coordinates", async () => {
  mockLastResponse = responseFor({flagId: "f1", lat: "10.7", lng: "106.6"}, 222);
  await expect(drainHazardLaunch()).resolves.toMatchObject({flagId: "f1", lat: 10.7, lng: 106.6});
  await expect(drainHazardLaunch()).resolves.toBeNull();
});
