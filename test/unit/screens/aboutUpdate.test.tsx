import {expect, jest, test, beforeEach, afterEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Platform, Pressable, Text} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AboutScreen from "../../../src/screens/AboutScreen";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: null, uid: null, loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
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

jest.mock("expo-linking", () => ({openURL: jest.fn(async () => undefined)}));

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({navigate: mockNavigate, setOptions: () => undefined}),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));

const realFetch = globalThis.fetch;
const realOS = Platform.OS;

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function textsUnder(node: ReactTestInstance): string[] {
  return node.findAllByType(Text).map((n) => {
    const kids = n.props.children as unknown;
    return Array.isArray(kids) ? kids.join("") : String(kids ?? "");
  });
}

function releaseResponse(tag: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: tag,
      body: "Notes",
      assets: [{name: `roadassist-${tag}.apk`, browser_download_url: "https://example.com/app.apk"}],
    }),
  } as Response;
}

async function mount() {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <AboutScreen />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(async () => {
  Object.defineProperty(Platform, "OS", {value: "android", configurable: true});
  await AsyncStorage.clear();
  mockNavigate.mockClear();
});

test("about shows identity rows and a diagnostics link", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all.some((text) => text.includes("0.1.0"))).toBe(true);
    expect(all).toContain(en.more.buildNumber);
    expect(all).toContain(en.more.backend);
    expect(all).toContain(en.more.sourceCode);
    expect(all).toContain(en.more.diagnostics);
    await act(async () => {
      renderer.root
        .findAll((n) => n.props?.accessibilityLabel === en.more.diagnostics && typeof n.props?.onPress === "function")
        .at(0)
        ?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("Diagnostics");
  } finally {
    renderer.unmount();
  }
});

test("about hides the update card off android", async () => {
  Object.defineProperty(Platform, "OS", {value: "ios", configurable: true});
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all).not.toContain(en.more.checkUpdates);
    expect(all).toContain(en.more.diagnostics);
  } finally {
    renderer.unmount();
  }
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Object.defineProperty(Platform, "OS", {value: realOS, configurable: true});
});

test("update card renders version, check row, and toggle on android", async () => {
  const renderer = await mount();
  try {
    const all = textsUnder(renderer.root);
    expect(all.some((text) => text.includes("0.1.0"))).toBe(true);
    expect(all).toContain(en.more.checkUpdates);
    expect(all).toContain(en.more.autoUpdate);
  } finally {
    renderer.unmount();
  }
});

test("auto toggle persists", async () => {
  const renderer = await mount();
  try {
    const toggle = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.autoUpdate)
      .find((n) => typeof n.props?.onPress === "function");
    expect(toggle).toBeDefined();
    await act(async () => {
      await toggle?.props.onPress();
    });
    expect(await AsyncStorage.getItem("roadassist.update.auto")).toBe("0");
    await act(async () => {
      await toggle?.props.onPress();
    });
    expect(await AsyncStorage.getItem("roadassist.update.auto")).toBe("1");
  } finally {
    renderer.unmount();
  }
});

test("manual check opens the dialog on a newer release", async () => {
  globalThis.fetch = (jest.fn(async () => releaseResponse("v0.2.0")) as unknown) as typeof fetch;
  const renderer = await mount();
  try {
    const row = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.checkUpdates)
      .find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
    });
    expect(textsUnder(renderer.root).some((text) => text.includes("v0.2.0"))).toBe(true);
  } finally {
    renderer.unmount();
  }
});

test("manual check reports up to date", async () => {
  globalThis.fetch = (jest.fn(async () => releaseResponse("v0.1.0")) as unknown) as typeof fetch;
  const renderer = await mount();
  try {
    const row = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.more.checkUpdates)
      .find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
    });
    expect(textsUnder(renderer.root)).toContain(en.more.upToDate);
  } finally {
    renderer.unmount();
  }
});
