import {expect, jest, test, beforeEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import DutySection from "../../../src/screens/DutySection";
import {en} from "../../../src/i18n/en";
import {lastBeat} from "../../../src/services/locationBeats";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

const mockProfile = {
  user: {id: "u1", role: "2", services: ["RIDER"] as string[], volunteerAvailable: false},
  refresh: async () => null,
  markOnboarded: async () => undefined,
};

jest.mock("../../../src/context/ProfileContext", () => ({
  useProfile: () => mockProfile,
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

jest.mock("../../../src/context/ThemeContext", () => ({
  useThemeMode: () => ({mode: "light" as const, toggle: () => undefined}),
  useAppMode: () => "light" as const,
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({navigate: jest.fn(), setOptions: () => undefined}),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));

jest.mock("../../../src/services/permissions", () => ({
  getPermissionStates: async () => ({notifications: {granted: true, canAskAgain: false}, backgroundLocation: {granted: true, canAskAgain: false}}),
  openAppSettings: () => undefined,
  openBatterySettings: () => undefined,
  requestBackgroundLocationPermission: async () => ({granted: true, canAskAgain: false}),
  requestNotificationPermission: async () => ({granted: true, canAskAgain: false}),
}));

const mockUpdateProvider = jest.fn(async () => ({updated: 1}));
const mockPing = jest.fn(async () => ({updated: 1, providerId: "tow1"}));
const mockChanged = jest.fn();
const mockNotice = jest.fn();
const mockError = jest.fn();

jest.mock("../../../src/api/providers", () => {
  const actual = jest.requireActual("../../../src/api/providers") as Record<string, unknown>;
  return {
    ...actual,
    myProviders: jest.fn(async () => []),
    updateProvider: (...args: unknown[]) => (mockUpdateProvider as (...a: unknown[]) => Promise<unknown>)(...args),
    pingProviderLocation: (...args: unknown[]) => (mockPing as (...a: unknown[]) => Promise<unknown>)(...args),
  };
});

jest.mock("../../../src/api/users", () => ({
  markOnboarded: async () => undefined,
  setVolunteerAvailability: async () => ({updated: 1, available: true}),
  updateUserServices: async () => ({updated: 1}),
  volunteerHeartbeat: async () => ({beat: 1}),
}));

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

async function mount(providers: object[] = []) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <DutySection providers={providers as never} onProvidersChanged={mockChanged} onNotice={mockNotice} onError={mockError} />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

function rowFor(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root
    .findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function")
    .at(0);
}

beforeEach(() => {
  mockUpdateProvider.mockClear();
  mockPing.mockClear();
  mockChanged.mockClear();
  mockNotice.mockClear();
  mockError.mockClear();
  mockProfile.user = {id: "u1", role: "2", services: ["RIDER"], volunteerAvailable: false};
});

test("renders nothing without roles or providers", async () => {
  const renderer = await mount();
  try {
    expect(textsUnder(renderer.root)).toEqual([]);
  } finally {
    renderer.unmount();
  }
});

test("tow and shop duty rows render with consequence hints", async () => {
  const renderer = await mount([TOW, SHOP]);
  try {
    const all = textsUnder(renderer.root);
    expect(all).toContain(en.more.dutyTow);
    expect(all).toContain(en.more.dutyWaiting);
    expect(all).toContain(en.more.dutyShop);
    expect(all).toContain(en.more.dutyShopOn);
  } finally {
    renderer.unmount();
  }
});

test("switching tow duty off writes every tower and skips the beat", async () => {
  const renderer = await mount([{...TOW}, {...TOW, id: "tow2", name: "Haul Two"}]);
  try {
    const row = rowFor(renderer, en.more.dutyTow);
    expect(row).toBeDefined();
    await act(async () => {
      await row?.props.onPress();
      await flush();
    });
    expect(mockUpdateProvider).toHaveBeenCalledTimes(2);
    expect(mockUpdateProvider).toHaveBeenCalledWith({providerId: "tow1", accepting: false}, "tok");
    expect(mockUpdateProvider).toHaveBeenCalledWith({providerId: "tow2", accepting: false}, "tok");
    expect(mockPing).not.toHaveBeenCalled();
    expect(mockChanged).toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});

test("switching tow duty on pings location and marks the beat", async () => {
  const renderer = await mount([{...TOW, accepting: false}]);
  try {
    expect(textsUnder(renderer.root)).toContain(en.more.dutyTowOff);
    const row = rowFor(renderer, en.more.dutyTow);
    await act(async () => {
      await row?.props.onPress();
      await flush();
    });
    expect(mockUpdateProvider).toHaveBeenCalledWith({providerId: "tow1", accepting: true}, "tok");
    expect(mockPing).toHaveBeenCalledTimes(1);
    expect(lastBeat("tower")).not.toBeNull();
    await act(async () => {
      renderer.update(
        <SafeAreaProvider initialMetrics={metrics}>
          <DutySection providers={[{...TOW, accepting: true}] as never} onProvidersChanged={mockChanged} onNotice={mockNotice} onError={mockError} />
        </SafeAreaProvider>,
      );
      await flush();
    });
    expect(textsUnder(renderer.root)).toContain(en.more.dutyTowOn);
  } finally {
    renderer.unmount();
  }
});

test("volunteer row toggles through its pressable", async () => {
  mockProfile.user = {id: "u1", role: "2", services: ["RIDER", "VOLUNTEER"], volunteerAvailable: false};
  const renderer = await mount();
  try {
    const row = rowFor(renderer, en.more.volTitle);
    expect(row).toBeDefined();
    await act(async () => {
      await row?.props.onPress();
      await flush();
    });
    expect(lastBeat("volunteer")).not.toBeNull();
    expect(mockNotice).toHaveBeenCalledWith(en.more.saved);
  } finally {
    renderer.unmount();
  }
});
