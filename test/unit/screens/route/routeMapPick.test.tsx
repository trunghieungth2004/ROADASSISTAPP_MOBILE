import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RouteScreen from "../../../../src/screens/RouteScreen";
import {clearGeocodeCache} from "../../../../src/api/places";
import {en} from "../../../../src/i18n/en";

jest.mock("../../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

jest.mock("../../../../src/context/ProfileContext", () => ({
  useProfile: () => ({
    vehicles: [{id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1}],
    activeVehicle: {id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1},
    activateVehicle: async () => undefined,
    hasVehicle: true,
    refresh: async () => null,
  }),
}));

jest.mock("../../../../src/context/NavSessionContext", () => ({
  useNavSession: () => ({session: null, start: mockStart, clear: jest.fn()}),
}));

jest.mock("../../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({navigate: jest.fn(), setOptions: jest.fn()}),
  useIsFocused: () => true,
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const realFetch = globalThis.fetch;

const mockStart = jest.fn();

function flatText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join(" ");
  if (node && typeof node === "object") return flatText((node as {props?: {children?: unknown}}).props?.children);
  return "";
}

function textsUnder(node: ReactTestInstance): string {
  return flatText(node.props?.children);
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function pickFieldPoint(renderer: ReturnType<typeof create>, fieldText: string): Promise<void> {
  const field = renderer.root
    .findAll((n) => typeof n.props?.onPress === "function")
    .find((n) => textsUnder(n).includes(fieldText));
  expect(field).toBeDefined();
  await act(async () => {
    await field?.props.onPress();
    await flush();
  });
  const mapButton = renderer.root.findAll(
    (n) => typeof n.props?.onPress === "function" && textsUnder(n).includes(en.route.pickOnMap),
  );
  expect(mapButton.length).toBeGreaterThan(0);
  await act(async () => {
    await mapButton[0].props.onPress();
    await flush();
  });
  const confirm = renderer.root.findAll(
    (n) => n.props?.accessibilityLabel === en.provider.useThisLocation && typeof n.props?.onPress === "function",
  );
  expect(confirm.length).toBeGreaterThan(0);
  await act(async () => {
    await confirm[0].props.onPress();
    await flush(12);
  });
}

test("route start seeds a session without any shop check-in", async () => {
  await clearGeocodeCache();
  mockStart.mockClear();
  globalThis.fetch = (jest.fn(async (url: string) => {
    if (String(url).includes("maptiler")) return {ok: true, json: async () => ({features: [{place_name: "Mock Route Point"}]})} as Response;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data: {routes: [{source: "test", geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]}, distanceMeters: 1500, durationSeconds: 300}]}}),
    } as Response;
  }) as unknown) as typeof fetch;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <RouteScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    await pickFieldPoint(renderer, en.route.selectOrigin);
    await pickFieldPoint(renderer, en.route.selectDestination);
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    await act(async () => {
      await flush(12);
    });
    const start = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && textsUnder(n).includes(en.nav.start))
      .pop();
    expect(start).toBeDefined();
    await act(async () => {
      await start?.props.onPress();
      await flush(12);
    });
    expect(mockStart).toHaveBeenCalledTimes(1);
    const session = mockStart.mock.calls[0]?.[0] as {checkIn?: unknown} | undefined;
    expect(session).not.toHaveProperty("checkIn");
  } finally {
    renderer.unmount();
    globalThis.fetch = realFetch;
  }
});

test("route destination search offers map pick and confirms into the field", async () => {
  await clearGeocodeCache();
  globalThis.fetch = (jest.fn(async () => ({ok: true, json: async () => ({features: [{place_name: "Mock Route Point"}]})}) as Response)) as unknown as typeof fetch;
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <RouteScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const destField = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function")
      .find((n) => textsUnder(n).includes(en.route.selectDestination));
    expect(destField).toBeDefined();
    await act(async () => {
      await destField?.props.onPress();
      await flush();
    });
    const mapButton = renderer.root.findAll(
      (n) => typeof n.props?.onPress === "function" && textsUnder(n).includes(en.route.pickOnMap),
    );
    expect(mapButton.length).toBeGreaterThan(0);
    await act(async () => {
      await mapButton[0].props.onPress();
      await flush();
    });
    expect(renderer.root.findAll((n) => typeof n.props?.onPress === "function").filter((n) => textsUnder(n).includes(en.route.pickOnMap)).length).toBe(0);
    const confirm = renderer.root.findAll(
      (n) => n.props?.accessibilityLabel === en.provider.useThisLocation && typeof n.props?.onPress === "function",
    );
    expect(confirm.length).toBeGreaterThan(0);
    await act(async () => {
      await confirm[0].props.onPress();
      await flush(12);
    });
    expect(renderer.root.findAll((n) => flatText(n.props?.children) === "Mock Route Point").length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
    globalThis.fetch = realFetch;
  }
});