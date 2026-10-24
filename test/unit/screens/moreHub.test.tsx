import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import MoreScreen from "../../../src/screens/MoreScreen";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: null, uid: null, loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

jest.mock("../../../src/context/ProfileContext", () => ({
  useProfile: () => ({
    user: {id: "u1", role: "2", services: ["RIDER", "VOLUNTEER", "VOLUNTEER"]},
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
  useAppMode: () => "light" as const,
}));

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({navigate: mockNavigate, setOptions: () => undefined}),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));

jest.mock("../../../src/api/flags", () => ({myFlags: async () => []}));
jest.mock("../../../src/api/providers", () => ({myProviders: async () => []}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, width: 390, height: 844, y: 0},
};

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
        <MoreScreen />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

function rowFor(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root
    .findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function")
    .at(0);
}

test("duplicated licenses render a single chip beside the role badge", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all.filter((text) => text === en.roles.mobileShop).length).toBe(1);
    expect(all.filter((text) => text === en.roles.rider).length).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("hub exposes payments, settings and about rows that navigate", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all).toContain(en.payments.title);
    expect(all).toContain(en.more.settings);
    expect(all).toContain(en.more.about);
    await act(async () => {
      rowFor(renderer, en.payments.title)?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("Payments");
    await act(async () => {
      rowFor(renderer, en.more.settings)?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("Settings");
    await act(async () => {
      rowFor(renderer, en.more.about)?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("About");
  } finally {
    renderer.unmount();
  }
});

test("hub no longer hosts permissions, providers, or saved places", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all).not.toContain(en.more.permNotifications);
    expect(all).not.toContain(en.provider.title);
    expect(all).not.toContain(en.route.savedPlaces);
    expect(all).not.toContain(en.more.diagnostics);
    expect(all).toContain(en.more.signOut);
  } finally {
    renderer.unmount();
  }
});

test("duty toggles sit between the profile header and settings", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    const profileAt = all.indexOf("—");
    const dutyAt = all.indexOf(en.more.volTitle);
    const settingsAt = all.indexOf(en.more.settings);
    expect(dutyAt).toBeGreaterThan(-1);
    expect(profileAt).toBeGreaterThan(-1);
    expect(settingsAt).toBeGreaterThan(-1);
    expect(dutyAt).toBeGreaterThan(profileAt);
    expect(dutyAt).toBeLessThan(settingsAt);
  } finally {
    renderer.unmount();
  }
});
