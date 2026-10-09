import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Pressable, Text} from "react-native";import MoreScreen from "../../../src/screens/MoreScreen";
import OnboardingScreen from "../../../src/screens/OnboardingScreen";
import {en} from "../../../src/i18n/en";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: null, uid: null, loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

jest.mock("../../../src/context/ProfileContext", () => ({
  useProfile: () => ({
    user: {id: "u1", role: "2", services: ["RIDER", "VOLUNTEER"]},
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

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({navigate: mockNavigate, setOptions: () => undefined}),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));

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

test("role picker stays unmounted until services opens", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <MoreScreen />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  expect(renderer.root.findAllByType(OnboardingScreen).length).toBe(0);
  const pressables = renderer.root.findAll((n) => typeof n.props?.onPress === "function");
  const servicesRow = pressables.find((row) => textsUnder(row).some((text) => text === en.more.services));
  expect(servicesRow).toBeDefined();
  await act(async () => {
    servicesRow?.props.onPress();
  });
  const pickers = renderer.root.findAllByType(OnboardingScreen);
  expect(pickers.length).toBe(1);
  expect(pickers[0].props.selectedServices).toEqual(["RIDER", "VOLUNTEER"]);
  renderer.unmount();
});

test("saved places row opens the manager sheet", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <MoreScreen />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const pressables = renderer.root.findAll((n) => typeof n.props?.onPress === "function");
    const row = pressables.find((r) => textsUnder(r).some((text) => text === en.route.savedPlaces));
    expect(row).toBeDefined();
    await act(async () => {
      row?.props.onPress();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(textsUnder(renderer.root).some((text) => text === en.common.add)).toBe(true);
  } finally {
    renderer.unmount();
  }
});
