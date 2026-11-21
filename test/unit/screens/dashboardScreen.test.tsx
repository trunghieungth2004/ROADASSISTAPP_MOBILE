import {beforeEach, expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import DashboardScreen from "../../../src/screens/more/DashboardScreen";
import {en} from "../../../src/i18n/en";
let mockServices = ["RIDER", "SHOP"];
let mockProviderRows: Array<{id: string; kind: string; status: string; name: string}> = [
  {id: "shop1", kind: "SHOP", status: "ACTIVE", name: "Fix Shop"},
];

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
  useBills: () => ({refresh: jest.fn()}),
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

jest.mock("../../../src/api/analytics", () => ({
  myAnalytics: async () => ({
    windowDays: 30,
    days: 30,
    startDate: "2026-10-18",
    endDate: "2026-11-16",
    generatedAt: "2026-11-16T05:00:00.000Z",
    comparison: {
      startDate: "2026-09-18",
      endDate: "2026-10-17",
      current: {
        rider: {spend: 100000, tickets: 3, completed: 2, bookings: 1},
        provider: {gross: 500000, net: 450000, taken: 5, completed: 4, bookings: 1},
      },
      previous: {
        rider: {spend: 80000, tickets: 2, completed: 1, bookings: 0},
        provider: {gross: 400000, net: 360000, taken: 4, completed: 3, bookings: 0},
      },
      change: {
        rider: {spend: 25, tickets: 50, completed: 100, bookings: 100},
        provider: {gross: 25, net: 25, taken: 25, completed: 33.3, bookings: 100},
      },
    },
    rider: {
      tickets: {total: 3, active: 1, completed: 2, byType: {TOW: 1}, byStatus: {}},
      payments: {count: 1, received: 1, gross: 100000, commission: 10000, refunded: 0, net: 90000},
      bookings: {total: 1, active: 1, completed: 0, cancelled: 0, declined: 0, noShow: 0, byStatus: {}, byService: []},
      services: {
        total: 3,
        byType: {TOW: 2, SOS: 1},
        byCategory: {},
        services: [{key: "TOW", name: "Tow", category: null, count: 2, revenue: 0}],
        topService: {key: "TOW", name: "Tow", count: 2, kind: "TYPE"},
      },
      series: [{date: "2026-11-01", tickets: 1, completed: 1, spend: 100000, bookings: 0}],
    },
    provider: {
      providers: [],
      tickets: {total: 5, taken: 5, active: 0, completed: 4, byType: {SHOP: 4}, byStatus: {}},
      earnings: {count: 1, received: 1, gross: 500000, commission: 50000, refunded: 0, net: 450000, commissionOwed: 50000},
      payouts: {count: 1, net: 450000},
      bookings: {total: 1, active: 1, completed: 0, cancelled: 0, declined: 0, noShow: 0, byStatus: {}, byService: []},
      rating: {avg: 4.5, count: 10},
      services: {
        total: 4,
        byType: {SHOP: 4},
        byCategory: {},
        services: [{key: "SHOP", name: "Shop", category: null, count: 4, revenue: 0}],
        topService: {key: "SHOP", name: "Shop", count: 4, kind: "TYPE"},
      },
      series: [{date: "2026-11-01", jobs: 1, completed: 1, earnings: 500000, bookings: 0}],
    },
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
    expect(riderView).toContain(en.more.dashboardActivity);

    await act(async () => {
      labelled(renderer, en.more.dashboardProvider)?.props.onPress();
      await flush();
    });

    const providerView = texts(renderer);
    expect(providerView).toContain(en.more.dashboardNet);
    expect(providerView).toContain(en.more.dashboardTaken);
    expect(providerView).toContain("450,000 VND");
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
    expect(texts(renderer)).toContain(en.more.dashboardNet);
    expect(texts(renderer)).toContain(en.more.dashboardTaken);
  } finally {
    renderer.unmount();
  }
});
