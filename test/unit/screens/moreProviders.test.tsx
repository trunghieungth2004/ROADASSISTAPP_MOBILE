import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import MoreScreen from "../../../src/screens/MoreScreen";
import {en} from "../../../src/i18n/en";
import {clearApiCache} from "../../../src/services/cache";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

jest.mock("../../../src/context/ProfileContext", () => ({
  useProfile: () => ({
    user: {id: "u1", role: "2", services: ["RIDER"]},
    refresh: async () => null,
    markOnboarded: async () => undefined,
  }),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

jest.mock("../../../src/context/ThemeContext", () => ({
  useThemeMode: () => ({mode: "light" as const, toggle: () => undefined}),
}));

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({navigate: jest.fn(), setOptions: () => undefined}),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
    useIsFocused: () => true,
  };
});

jest.mock("../../../src/api/flags", () => ({
  myFlags: async () => [],
}));

jest.mock("../../../src/services/permissions", () => ({
  getPermissionStates: async () => ({notifications: {granted: true, canAskAgain: false}, backgroundLocation: {granted: true, canAskAgain: false}}),
  openAppSettings: () => undefined,
  openBatterySettings: () => undefined,
  requestBackgroundLocationPermission: async () => ({granted: true, canAskAgain: false}),
  requestNotificationPermission: async () => ({granted: true, canAskAgain: false}),
}));

const mockMyProviders = jest.fn(async (_providers: object[]) => _providers);

jest.mock("../../../src/api/providers", () => {
  const actual = jest.requireActual("../../../src/api/providers") as Record<string, unknown>;
  return {
    ...actual,
    myProviders: (...args: unknown[]) => (mockMyProviders as (...a: unknown[]) => Promise<unknown>)(...args),
    createProvider: async () => ({id: "p9"}),
    updateProvider: async () => ({updated: 1}),
  };
});

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function shownLabels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

function consoleIcons(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll(
    (n) => n.props?.accessibilityLabel === en.provider.console && typeof n.props?.onPress === "function",
  );
}

const SHOP_ACTIVE = {id: "shop1", kind: "SHOP", name: "Fix", lat: 10.7, lng: 106.6, status: "ACTIVE", accepting: true};
const TOW_ACTIVE = {id: "tow1", kind: "TOW", name: "Haul", lat: 10.7, lng: 106.6, status: "ACTIVE", accepting: true, plate: "51H-12345"};

async function mountWith(providers: object[]): Promise<ReturnType<typeof create>> {
  mockMyProviders.mockReset();
  mockMyProviders.mockResolvedValue(providers);
  clearApiCache();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <MoreScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

test("provider badges show shop and tow beside the rider license", async () => {
  const renderer = await mountWith([SHOP_ACTIVE, TOW_ACTIVE]);
  try {
    const labels = shownLabels(renderer);
    expect(labels).toContain(en.roles.rider);
    expect(labels).toContain(en.roles.shop);
    expect(labels).toContain(en.roles.tow);
  } finally {
    renderer.unmount();
  }
});

test("provider rows carry no console icon", async () => {
  const renderer = await mountWith([SHOP_ACTIVE, TOW_ACTIVE]);
  try {
    expect(consoleIcons(renderer)).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("denied shops leave no badge and no console", async () => {
  const renderer = await mountWith([{...SHOP_ACTIVE, status: "DENIED"}]);
  try {
    const labels = shownLabels(renderer);
    expect(labels).not.toContain(en.roles.shop);
    expect(consoleIcons(renderer)).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});
