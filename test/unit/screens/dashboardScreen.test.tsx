import {beforeEach, expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import DashboardScreen from "../../../src/screens/more/DashboardScreen";
import {en} from "../../../src/i18n/en";
import type {Bill} from "../../../src/api/bills";

let mockServices = ["RIDER", "SHOP"];
let mockProviderRows: Array<{id: string; kind: string; status: string; name: string}> = [
  {id: "shop1", kind: "SHOP", status: "ACTIVE", name: "Fix Shop"},
];

const mockBills: Bill[] = [{
  billId: "bill1",
  ticketId: "t1",
  ticketType: "TOW",
  ticketStatus: "4",
  createdAt: "2026-01-01T00:00:00.000Z",
  currency: "VND",
  total: 100000,
  paid: 100000,
  due: 0,
  status: "PAID",
  viewer: "RIDER",
  canPay: true,
  items: [],
}];

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

jest.mock("../../../src/context/ProfileContext", () => ({
  useProfile: () => ({
    bundle: {user: {id: "u1", role: "2", services: mockServices}},
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

jest.mock("../../../src/context/BillsContext", () => ({
  useBills: () => ({bills: mockBills, refresh: jest.fn()}),
}));

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({navigate: jest.fn(), setOptions: jest.fn()}),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
  };
});

jest.mock("../../../src/api/providers", () => ({
  myProviders: async () => mockProviderRows,
  providerStats: async () => ({
    providers: [{id: "shop1", name: "Fix Shop", kind: "SHOP", completedJobs: 12, ratingAvg: 4.5, ratingCount: 10}],
    payouts: {gross: 500000, net: 450000, commissionOwed: 50000},
  }),
}));

jest.mock("../../../src/api/ratings", () => ({
  receivedRatings: async () => ({
    rider: {avg: 4.8, count: 5},
    providers: [{id: "shop1", name: "Fix Shop", avg: 4.5, count: 10}],
  }),
}));

jest.mock("../../../src/api/bookings", () => ({
  shopBookings: async () => ({
    bookings: [{id: "b1", status: "REQUESTED", scheduledAt: "2026-01-01T00:00:00.000Z"}],
  }),
}));

jest.mock("../../../src/api/dispatch", () => {
  const actual = jest.requireActual("../../../src/api/dispatch") as Record<string, unknown>;
  return {
    ...actual,
    shopRequests: async () => [{id: "req1"}],
    shopRecords: async () => [{id: "rec1", ticketType: "TOW", status: "4", createdAt: "2026-01-01T00:00:00.000Z"}],
  };
});

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root.findAllByType(Text).map((node: ReactTestInstance) => {
    const children = node.props.children as unknown;
    return Array.isArray(children) ? children.join("") : String(children ?? "");
  });
}

function labelled(renderer: ReturnType<typeof create>, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll((node) =>
    node.props?.accessibilityLabel === label &&
    typeof node.props?.onPress === "function")[0];
}

async function flush(times = 10): Promise<void> {
  for (let index = 0; index < times; index++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function mount() {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <DashboardScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  mockServices = ["RIDER", "SHOP"];
  mockProviderRows = [{id: "shop1", kind: "SHOP", status: "ACTIVE", name: "Fix Shop"}];
});

test("shows rider activity first and switches to provider activity", async () => {
  const renderer = await mount();
  try {
    const riderView = texts(renderer);
    expect(riderView).toContain(en.more.dashboardTrips);
    expect(riderView).toContain(en.more.dashboardSpend);
    expect(riderView).toContain("100,000 VND");
    expect(riderView).toContain(en.more.dashboardMonthly);

    await act(async () => {
      labelled(renderer, en.more.dashboardProvider)?.props.onPress();
      await flush();
    });

    const providerView = texts(renderer);
    expect(providerView).toContain(en.more.dashboardEarned);
    expect(providerView).toContain("500,000 VND");
    expect(providerView).toContain(en.more.dashboardPending);
  } finally {
    renderer.unmount();
  }
});

test("provider-only users land on the provider view without a switch", async () => {
  mockServices = ["TOW"];
  mockProviderRows = [{id: "tow1", kind: "TOW", status: "ACTIVE", name: "Tow Co"}];
  const renderer = await mount();
  try {
    expect(labelled(renderer, en.more.dashboardRider)).toBeUndefined();
    expect(texts(renderer)).toContain(en.more.dashboardEarned);
  } finally {
    renderer.unmount();
  }
});
