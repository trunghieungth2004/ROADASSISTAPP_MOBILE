import {beforeEach, expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import PaymentsScreen from "../../../src/screens/PaymentsScreen";
import {en} from "../../../src/i18n/en";
import type {Bill} from "../../../src/api/bills";
import type {Provider} from "../../../src/api/providers";

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
  useAppMode: () => "light" as const,
}));

const mockNavigate = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
let mockBills: {
  bills: Bill[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dueCount: number;
  dueTotal: number;
};

jest.mock("../../../src/context/BillsContext", () => ({
  useBills: () => mockBills,
}));

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({navigate: (...args: unknown[]) => mockNavigate(...args), setOptions: () => undefined}),
    useRoute: () => ({params: {}}),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
  };
});

const mockPayeeBills = jest.fn(async () => [] as Bill[]);
const mockMyProviders = jest.fn(async () => [] as Provider[]);
const mockMyPayouts = jest.fn(async () => ({
  batches: [],
  pending: {gross: 0, commission: 0, net: 0, refunded: 0, itemCount: 0},
  settled: {gross: 0, commission: 0, net: 0, itemCount: 0},
}));

jest.mock("../../../src/api/bills", () => ({
  payeeBills: (...args: unknown[]) => (mockPayeeBills as (...a: unknown[]) => Promise<Bill[]>)(...args),
}));

jest.mock("../../../src/api/providers", () => ({
  myProviders: (...args: unknown[]) => (mockMyProviders as (...a: unknown[]) => Promise<Provider[]>)(...args),
}));

jest.mock("../../../src/api/payouts", () => ({
  myPayouts: (...args: unknown[]) => (mockMyPayouts as (...a: unknown[]) => Promise<unknown>)(...args),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const RIDER_BILL: Bill = {
  billId: "tow1",
  ticketId: "tow1",
  ticketType: "TOW",
  ticketStatus: "4",
  createdAt: "2026-10-03T10:00:00.000Z",
  currency: "VND",
  total: 370000,
  paid: 0,
  due: 370000,
  status: "UNPAID",
  viewer: "RIDER",
  canPay: true,
  items: [
    {kind: "TOW_FARE", ticketId: "tow1", ticketType: "TOW", ticketStatus: "4", amount: 220000, waitingFee: 0, status: "UNPAID", payeeId: "op1", payeeName: "Tow Co", qrUrl: null, payment: null},
  ],
};

const PAYEE_BILL: Bill = {
  billId: "tow1",
  ticketId: "tow1",
  ticketType: "TOW",
  ticketStatus: "4",
  createdAt: "2026-10-03T10:00:00.000Z",
  currency: "VND",
  total: 150000,
  paid: 150000,
  due: 0,
  status: "PAID",
  viewer: "PAYEE",
  canPay: false,
  items: [
    {
      kind: "REPAIR",
      ticketId: "walk1",
      ticketType: "WALK_IN",
      ticketStatus: "9",
      amount: 150000,
      waitingFee: 0,
      status: "PAID",
      payeeId: "op2",
      payeeName: "Fix Shop",
      qrUrl: null,
      payment: {
        id: "p2",
        method: "CASH",
        status: "CONFIRMED",
        amount: 150000,
        refundAmount: null,
        commissionRate: 10,
        commissionAmount: 15000,
        payoutAmount: 135000,
        payoutRef: null,
        payoutAt: null,
        payoutStatus: "PENDING",
        canConfirmCash: false,
      },
    },
  ],
};

const SHOP: Provider = {
  id: "shop1",
  kind: "SHOP",
  status: "ACTIVE",
  name: "Fix Shop",
} as Provider;

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root.findAllByType(Text).map((n) => {
    const kids = n.props.children as unknown;
    return Array.isArray(kids) ? kids.join("") : String(kids ?? "");
  });
}

function pressable(renderer: ReturnType<typeof create>, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function")[0];
}

async function mount() {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PaymentsScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  mockBills = {bills: [], dueCount: 0, dueTotal: 0, loading: false, error: null, refresh: mockRefresh};
  mockRefresh.mockClear();
  mockNavigate.mockClear();
  mockPayeeBills.mockReset();
  mockPayeeBills.mockResolvedValue([]);
  mockMyProviders.mockReset();
  mockMyProviders.mockResolvedValue([]);
  mockMyPayouts.mockReset();
  mockMyPayouts.mockResolvedValue({
    batches: [],
    pending: {gross: 0, commission: 0, net: 0, refunded: 0, itemCount: 0},
    settled: {gross: 0, commission: 0, net: 0, itemCount: 0},
  });
});

test("a rider without a provider sees only the to-pay list", async () => {
  mockBills.bills = [RIDER_BILL];
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.payments.toPay);
    expect(all).not.toContain(en.payments.toReceive);
    expect(all).toContain(en.bills.journey);
    expect(mockPayeeBills).toHaveBeenCalledWith("tok");
  } finally {
    renderer.unmount();
  }
});

test("a provider switches between to-pay and to-receive", async () => {
  mockBills.bills = [RIDER_BILL];
  mockMyProviders.mockResolvedValue([SHOP]);
  mockPayeeBills.mockResolvedValue([PAYEE_BILL]);
  const renderer = await mount();
  try {
    expect(texts(renderer)).toContain(en.payments.toReceive);
    const receiveTab = pressable(renderer, en.payments.toReceive);
    expect(receiveTab).toBeDefined();
    await act(async () => {
      receiveTab?.props.onPress?.();
      await flush();
    });
    const all = texts(renderer);
    expect(all).toContain("135,000 VND");
    expect(all).toContain(en.payments.payoutPending);
    expect(all).toContain(`${en.payments.collected} 150,000`);
    const row = pressable(renderer, `${en.bills.journey} 135,000 VND`);
    expect(row).toBeDefined();
    await act(async () => {
      row?.props.onPress?.();
    });
    expect(mockNavigate).toHaveBeenCalledWith("BillDetail", {ticketId: "tow1", scope: "payee"});
  } finally {
    renderer.unmount();
  }
});

test("a provider without earnings sees the receive empty state", async () => {
  mockMyProviders.mockResolvedValue([SHOP]);
  const renderer = await mount();
  try {
    const receiveTab = pressable(renderer, en.payments.toReceive);
    await act(async () => {
      receiveTab?.props.onPress?.();
      await flush();
    });
    expect(texts(renderer)).toContain(en.payments.emptyReceive);
    expect(texts(renderer)).toContain(en.payments.emptyReceiveHint);
  } finally {
    renderer.unmount();
  }
});
