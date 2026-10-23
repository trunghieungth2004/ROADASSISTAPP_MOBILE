import {expect, jest, test, afterAll} from "@jest/globals";
import {Platform} from "react-native";
import * as Notifications from "expo-notifications";
import {syncPushToken} from "../../../src/services/push";

const mockStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiGet: async (keys: string[]) => keys.map((key) => [key, mockStore.get(key) ?? null]),
  multiSet: async (pairs: [string, string][]) => {
    for (const [key, value] of pairs) mockStore.set(key, value);
  },
  multiRemove: async (keys: string[]) => {
    for (const key of keys) mockStore.delete(key);
  },
  getItem: async (key: string) => mockStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

const mockRegisterPush = jest.fn(async () => undefined);

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  getPermissionsAsync: jest.fn(async () => ({granted: true, canAskAgain: false})),
  requestPermissionsAsync: jest.fn(async () => ({granted: true})),
  getDevicePushTokenAsync: jest.fn(async () => ({data: "dev1"})),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  addPushTokenListener: jest.fn(() => ({remove: jest.fn()})),
  AndroidImportance: {DEFAULT: 3, HIGH: 4},
}));

jest.mock("../../../src/api/push", () => ({
  registerPush: (...args: unknown[]) => (mockRegisterPush as (...a: unknown[]) => Promise<void>)(...args),
  unregisterPush: async () => ({removed: true}),
}));

const realOS = Platform.OS;

afterAll(() => {
  Object.defineProperty(Platform, "OS", {value: realOS, configurable: true});
});

test("creates Android channels before requesting the device token", async () => {
  Object.defineProperty(Platform, "OS", {value: "android", configurable: true});
  let channelsReady = false;
  jest.mocked(Notifications.setNotificationChannelAsync).mockImplementation(async (id: string) => {
    await Promise.resolve();
    if (id === "dispatch") channelsReady = true;
    return null;
  });
  jest.mocked(Notifications.getDevicePushTokenAsync).mockImplementation(async () => {
    if (!channelsReady) throw new Error("token requested before channels");
    return {data: "dev1"} as never;
  });
  mockRegisterPush.mockClear();
  await expect(syncPushToken("tok", "u1")).resolves.toBe(true);
  expect(mockRegisterPush).toHaveBeenCalledWith("tok", "dev1");
  expect(jest.mocked(Notifications.setNotificationChannelAsync).mock.calls.map((call) => call[0])).toEqual(
    expect.arrayContaining(["hazard", "dispatch", "dispatch-urgent", "payments"]),
  );
});
