import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import OnboardingScreen from "../../../src/screens/OnboardingScreen";
import {clearGeocodeCache} from "../../../src/api/places";
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

jest.mock("expo-location", () => ({
  getCurrentPositionAsync: jest.fn(async () => ({coords: {latitude: 10.7, longitude: 106.6}})),
  Accuracy: {Balanced: 3},
  requestForegroundPermissionsAsync: jest.fn(async () => ({status: "granted", granted: true})),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const realFetch = globalThis.fetch;

function textsUnder(node: ReactTestInstance): string[] {
  return node.findAll((n) => n.props?.children !== undefined && n.props?.children !== null).map((n) => flatText(n.props.children));
}

function flatText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join("");
  if (node && typeof node === "object") return flatText((node as {props?: {children?: unknown}}).props?.children);
  return "";
}

async function mountTow() {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <OnboardingScreen t={en} lang="en" token="tok" selectedServices={["RIDER"]} onFinish={() => undefined} onSkip={() => undefined} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  const towToggle = renderer.root
    .findAll((n) => typeof n.props?.onPress === "function")
    .find((n) => textsUnder(n).some((text) => text.includes(en.roles.tow)));
  expect(towToggle).toBeDefined();
  await act(async () => {
    await towToggle?.props.onPress();
  });
  return renderer;
}

test("onboarding tow address search offers map pick and confirms the point", async () => {
  await clearGeocodeCache();
  const renderer = await mountTow();
  try {
    const field = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.provider.towAddress && typeof n.props?.onPress === "function")[0];
    expect(field).toBeDefined();
    await act(async () => {
      await field.props.onPress();
    });
    const mapButton = renderer.root.findAll(
      (n) => typeof n.props?.onPress === "function" && textsUnder(n).includes(en.route.pickOnMap),
    );
    expect(mapButton.length).toBeGreaterThan(0);
    globalThis.fetch = (jest.fn(async () => ({ok: true, json: async () => ({features: [{place_name: "Mock Tow Yard"}]})}) as Response)) as unknown as typeof fetch;
    await act(async () => {
      await mapButton[0].props.onPress();
    });
    expect(textsUnder(renderer.root).includes(en.route.pickOnMap)).toBe(false);
    const confirm = renderer.root.findAll(
      (n) => n.props?.accessibilityLabel === en.provider.useThisLocation && typeof n.props?.onPress === "function",
    );
    expect(confirm.length).toBeGreaterThan(0);
    await act(async () => {
      await confirm.pop()?.props.onPress();
    });
    const shown = textsUnder(renderer.root).join(" ");
    expect(shown.includes(en.provider.towAddressUnset)).toBe(false);
    expect(shown).toContain(en.provider.towPositionSet);
  } finally {
    renderer.unmount();
    globalThis.fetch = realFetch;
  }
});