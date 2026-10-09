import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import NavigationScreen from "../../../src/screens/NavigationScreen";
import {clearApiCache} from "../../../src/services/cache";
import type {RouteOption} from "../../../src/api/routes";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true}),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

const SESSION = {
  route: {
    source: "test",
    geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]},
    distanceMeters: 1500,
    durationSeconds: 300,
  } as RouteOption,
  dest: {lat: 10.71, lng: 106.61},
  seed: {lat: 10.7, lng: 106.6},
  stops: [],
};

jest.mock("../../../src/context/NavSessionContext", () => {
  const actual = jest.requireActual("../../../src/context/NavSessionContext") as typeof import("../../../src/context/NavSessionContext");
  return {
    ...actual,
    useNavSession: () => ({session: SESSION, start: () => undefined, clear: () => undefined}),
  };
});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({goBack: jest.fn(), setOptions: jest.fn()}),
  useIsFocused: () => true,
}));

jest.mock("expo-speech", () => ({
  stop: jest.fn(),
  speak: jest.fn(() => undefined),
  getAvailableVoicesAsync: jest.fn(async () => []),
  VoiceQuality: {Enhanced: "enhanced"},
}));

type NotificationListener = (n: {request: {content: {data: Record<string, string>}}}) => void;
const mockReceivedListeners: NotificationListener[] = [];

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn((fn: NotificationListener) => {
    mockReceivedListeners.push(fn);
    return {remove: jest.fn()};
  }),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  getPermissionsAsync: jest.fn(async () => ({granted: true})),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  setNotificationHandler: jest.fn(),
}));

jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const stub = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, props, props.children);
  return {
    Map: stub("Map"),
    Camera: stub("Camera"),
    GeoJSONSource: stub("GeoJSONSource"),
    Layer: stub("Layer"),
    Images: stub("Images"),
  };
});

const realFetch = globalThis.fetch;
let getFlagCalls = 0;

function envelope(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data}),
  } as Response;
}

function installFetch(): void {
  getFlagCalls = 0;
  const spy = jest.fn(async (url: string) => {
    const path = new URL(String(url)).pathname;
    if (path === "/flags/near") return envelope([]);
    if (path === "/flags/get") {
      getFlagCalls += 1;
      return envelope({id: "push-con-1", type: "FLOOD", lat: 10.705, lng: 106.605, radiusMeters: 200, status: "2", voteCount: 3});
    }
    throw new Error("down");
  });
  globalThis.fetch = (spy as unknown) as typeof fetch;
}

function firePush(data: Record<string, string>): void {
  for (const fn of [...mockReceivedListeners]) {
    fn({request: {content: {data}}});
  }
}

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function dotSources(renderer: ReturnType<typeof create>): {id: string; ids: string[]}[] {
  const nodes = renderer.root.findAll(
    (n: ReactTestInstance) => String(n.type) === "GeoJSONSource" && String((n.props as {id?: string}).id ?? "").startsWith("flag-dot-"),
  );
  return nodes.map((n) => {
    const props = n.props as {id: string; data?: {features?: {properties?: {id?: string}}[]}};
    const ids: string[] = [];
    for (const f of props.data?.features ?? []) {
      if (typeof f.properties?.id === "string") ids.push(f.properties.id);
    }
    return {id: props.id, ids};
  });
}

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

async function mount(): Promise<ReturnType<typeof create>> {
  mockReceivedListeners.length = 0;
  clearApiCache();
  installFetch();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <NavigationScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  const out = renderer as ReturnType<typeof create>;
  expect(out.toJSON()).not.toBeNull();
  return out;
}

test("suggested push with coords seeds a pin with zero flag fetches", async () => {
  const renderer = await mount();
  try {
    getFlagCalls = 0;
    await act(async () => {
      firePush({flagId: "push-sug-1", type: "FLOOD", status: "1", lat: "10.705", lng: "106.605", radiusMeters: "200"});
      await flush();
    });
    expect(getFlagCalls).toBe(0);
    const sources = dotSources(renderer);
    expect(sources.find((s) => s.id === "flag-dot-pin-flood-1")?.ids).toContain("push-sug-1");
  } finally {
    renderer.unmount();
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});

test("confirmed push still fetches the flag once", async () => {
  const renderer = await mount();
  try {
    getFlagCalls = 0;
    await act(async () => {
      firePush({flagId: "push-con-1", type: "FLOOD", status: "2", lat: "10.705", lng: "106.605", radiusMeters: "200"});
      await flush(10);
    });
    expect(getFlagCalls).toBe(1);
  } finally {
    renderer.unmount();
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});

test("push without coords falls back to a flag fetch", async () => {
  const renderer = await mount();
  try {
    getFlagCalls = 0;
    await act(async () => {
      firePush({flagId: "push-nocoord-1", type: "FLOOD", status: "1"});
      await flush(10);
    });
    expect(getFlagCalls).toBe(1);
  } finally {
    renderer.unmount();
    globalThis.fetch = realFetch;
    clearApiCache();
  }
});
