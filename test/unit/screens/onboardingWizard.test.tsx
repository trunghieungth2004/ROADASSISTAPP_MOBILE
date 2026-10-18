import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import OnboardingScreen from "../../../src/screens/OnboardingScreen";
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

function shown(renderer: ReturnType<typeof create>): string {
  return textsUnder(renderer.root).join(" ");
}

function pressableWith(renderer: ReturnType<typeof create>, text: string): ReactTestInstance | undefined {
  return renderer.root
    .findAll((n) => typeof n.props?.onPress === "function")
    .find((n) => textsUnder(n).some((value) => value.includes(text)));
}

async function press(node: ReactTestInstance | undefined): Promise<void> {
  expect(node).toBeDefined();
  await act(async () => {
    await node?.props.onPress();
  });
}

async function mount(props?: {selectedServices?: string[]; registered?: {shop: boolean; tow: boolean}}) {
  const onFinish = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <OnboardingScreen t={en} lang="en" token="tok" selectedServices={props?.selectedServices ?? ["RIDER"]} registered={props?.registered} onFinish={onFinish} onSkip={() => undefined} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("mount failed");
  return {renderer, onFinish};
}

test("roles continue with no new selections finishes immediately", async () => {
  const {renderer, onFinish} = await mount();
  try {
    await press(pressableWith(renderer, en.roles.done));
    expect(onFinish).toHaveBeenCalledWith(["RIDER"], null, null);
  } finally {
    renderer.unmount();
  }
});

test("selecting the shop continues into the shop step and validates inline", async () => {
  const {renderer, onFinish} = await mount();
  try {
    await press(pressableWith(renderer, en.roles.shopHint));
    await press(pressableWith(renderer, en.roles.done));
    let text = shown(renderer);
    expect(text).toContain(en.provider.addShop);
    expect(text).toContain(en.provider.addressUnset);
    expect(text).not.toContain(en.roles.subtitle);
    await press(pressableWith(renderer, en.roles.done));
    text = shown(renderer);
    expect(text).toContain(en.provider.invalidName);
    expect(onFinish).not.toHaveBeenCalled();
    const back = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.common.back && typeof n.props?.onPress === "function")[0];
    await press(back);
    text = shown(renderer);
    expect(text).toContain(en.roles.subtitle);
    expect(text).not.toContain(en.provider.addressUnset);
  } finally {
    renderer.unmount();
  }
});

test("selecting the tow continues into the tow step and finish validates it", async () => {
  const {renderer, onFinish} = await mount();
  try {
    await press(pressableWith(renderer, en.roles.towHint));
    await press(pressableWith(renderer, en.roles.done));
    let text = shown(renderer);
    expect(text).toContain(en.tow.register);
    expect(text).toContain(en.provider.towAddressUnset);
    await press(pressableWith(renderer, en.roles.finish));
    text = shown(renderer);
    expect(text).toContain(en.provider.invalidName);
    expect(onFinish).not.toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});

test("registered providers show as locked and are not re-routed", async () => {
  const {renderer, onFinish} = await mount({selectedServices: ["RIDER"], registered: {shop: true, tow: true}});
  try {
    const text = shown(renderer);
    expect(text).toContain(en.provider.registered);
    await press(pressableWith(renderer, en.roles.done));
    expect(onFinish).toHaveBeenCalledWith(["RIDER"], null, null);
  } finally {
    renderer.unmount();
  }
});
