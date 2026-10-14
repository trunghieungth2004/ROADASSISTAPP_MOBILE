import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import PermissionsScreen from "../../../src/screens/PermissionsScreen";
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

jest.mock("../../../src/services/permissions", () => ({
  getPermissionStates: async () => ({notifications: {granted: false, canAskAgain: true}, backgroundLocation: {granted: false, canAskAgain: false}}),
  openAppSettings: jest.fn(),
  openBatterySettings: jest.fn(),
  requestBackgroundLocationPermission: jest.fn(async () => ({granted: true, canAskAgain: false})),
  requestNotificationPermission: jest.fn(async () => ({granted: true, canAskAgain: false})),
}));

jest.mock("../../../src/services/push", () => ({
  syncPushToken: jest.fn(async () => true),
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

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

test("permissions card renders all three rows with states", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PermissionsScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const all = textsUnder(renderer.root);
    expect(all).toContain(en.more.permNotifications);
    expect(all).toContain(en.more.permBackground);
    expect(all).toContain(en.more.permBattery);
    expect(all).toContain(en.more.permEnable);
    expect(all).toContain(en.more.permOpenSettings);
  } finally {
    renderer.unmount();
  }
});
