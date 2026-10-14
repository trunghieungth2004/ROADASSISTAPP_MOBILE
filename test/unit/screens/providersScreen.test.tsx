import {expect, jest, test, beforeEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import ProvidersScreen from "../../../src/screens/ProvidersScreen";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
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

const mockMyProviders = jest.fn(async () => [] as unknown[]);
const mockUpdateProvider = jest.fn(async () => ({updated: 1}));

jest.mock("../../../src/api/providers", () => {
  const actual = jest.requireActual("../../../src/api/providers") as Record<string, unknown>;
  return {
    ...actual,
    myProviders: (...args: unknown[]) => (mockMyProviders as (...a: unknown[]) => Promise<unknown>)(...args),
    updateProvider: (...args: unknown[]) => (mockUpdateProvider as (...a: unknown[]) => Promise<unknown>)(...args),
  };
});

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const TOW = {id: "tow1", kind: "TOW", name: "Haul", lat: 10.7, lng: 106.6, status: "ACTIVE", accepting: true, plate: "51H-12345"};
const SHOP = {id: "shop1", kind: "SHOP", name: "Fix", lat: 10.7, lng: 106.6, status: "ACTIVE", accepting: true};

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function textsUnder(node: ReactTestInstance): string[] {
  return node.findAllByType(Text).map((n) => {
    const kids = n.props.children as unknown;
    return Array.isArray(kids) ? kids.join("") : String(kids ?? "");
  });
}

async function mount() {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProvidersScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  mockMyProviders.mockReset();
  mockUpdateProvider.mockClear();
  mockMyProviders.mockResolvedValue([]);
});

test("header offers registration for each missing kind", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all).toContain(en.provider.addShop);
    expect(all).toContain(en.provider.registerTow);
  } finally {
    renderer.unmount();
  }
});

test("registered kinds hide their register button", async () => {
  mockMyProviders.mockResolvedValue([TOW, SHOP]);
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all).not.toContain(en.provider.addShop);
    expect(all).not.toContain(en.provider.registerTow);
    expect(all).toContain("Haul");
    expect(all).toContain("Fix");
  } finally {
    renderer.unmount();
  }
});

test("register button opens the matching form", async () => {
  const renderer = await mount();
  try {
    const button = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.provider.registerTow && typeof n.props?.onPress === "function")
      .at(0);
    expect(button).toBeDefined();
    await act(async () => {
      await button?.props.onPress();
      await flush();
    });
    expect(textsUnder(renderer.root).filter((text) => text === en.provider.registerTow).length).toBe(2);
  } finally {
    renderer.unmount();
  }
});

test("per-row switch toggles that provider only", async () => {
  mockMyProviders.mockResolvedValue([TOW, SHOP]);
  const renderer = await mount();
  try {
    const switches = renderer.root.findAll((n) => typeof n.props?.onValueChange === "function");
    expect(switches.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      await switches[0]?.props.onValueChange(false);
      await flush();
    });
    expect(mockUpdateProvider).toHaveBeenCalledTimes(1);
    expect(mockUpdateProvider).toHaveBeenCalledWith({providerId: "tow1", accepting: false}, "tok");
  } finally {
    renderer.unmount();
  }
});
