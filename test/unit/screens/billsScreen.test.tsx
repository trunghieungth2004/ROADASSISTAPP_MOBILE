import {expect, jest, test, beforeEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import BillsScreen from "../../../src/screens/BillsScreen";
import {en} from "../../../src/i18n/en";
import type {Bill} from "../../../src/api/bills";

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

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({navigate: (...args: unknown[]) => mockNavigate(...args), setOptions: () => undefined}),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
    useIsFocused: () => true,
  };
});

const mockMyBills = jest.fn(async () => [] as Bill[]);

jest.mock("../../../src/api/bills", () => ({
  myBills: (...args: unknown[]) => (mockMyBills as (...a: unknown[]) => Promise<Bill[]>)(...args),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const TOW_BILL: Bill = {
  billId: "tow1",
  ticketId: "tow1",
  ticketType: "TOW",
  ticketStatus: "4",
  createdAt: "2026-10-03T10:00:00.000Z",
  currency: "VND",
  total: 370000,
  paid: 150000,
  due: 220000,
  status: "PARTIAL",
  items: [
    {kind: "TOW_FARE", ticketId: "tow1", ticketType: "TOW", ticketStatus: "4", amount: 220000, waitingFee: 20000, status: "PENDING", payeeId: "op1", payeeName: "Tow Co", qrUrl: null, payment: {id: "p1", method: "SEPAY", status: "PENDING", amount: 220000, refundAmount: null}},
    {kind: "REPAIR", ticketId: "walk1", ticketType: "WALK_IN", ticketStatus: "6", amount: 150000, waitingFee: 0, status: "PAID", payeeId: "op2", payeeName: "Fix Shop", qrUrl: null, payment: {id: "p2", method: "CASH", status: "CONFIRMED", amount: 150000, refundAmount: null}},
  ],
};

const WALK_BILL: Bill = {
  billId: "walk2",
  ticketId: "walk2",
  ticketType: "WALK_IN",
  ticketStatus: "1",
  createdAt: "2026-10-02T10:00:00.000Z",
  currency: "VND",
  total: 90000,
  paid: 0,
  due: 90000,
  status: "UNPAID",
  items: [
    {kind: "REPAIR", ticketId: "walk2", ticketType: "WALK_IN", ticketStatus: "1", amount: 90000, waitingFee: 0, status: "UNPAID", payeeId: null, payeeName: "Fix Shop", qrUrl: null, payment: null},
  ],
};

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
        <BillsScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  mockMyBills.mockReset();
  mockMyBills.mockResolvedValue([]);
  mockNavigate.mockClear();
});

test("bills show the empty state", async () => {
  const renderer = await mount();
  try {
    expect(texts(renderer)).toContain(en.bills.empty);
  } finally {
    renderer.unmount();
  }
});

test("bills list journeys and standalone visits", async () => {
  mockMyBills.mockResolvedValue([TOW_BILL, WALK_BILL]);
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.journey);
    expect(all).toContain(en.bills.visit);
    expect(all).toContain("370,000 VND");
    expect(all).toContain("90,000 VND");
    expect(all).toContain(en.bills.statusPartial);
    expect(all).toContain(en.bills.statusUnpaid);
    expect(all).toContain("03/10/2026 · 2 items · Tow Co · Fix Shop");
  } finally {
    renderer.unmount();
  }
});

test("tapping a bill opens its detail", async () => {
  mockMyBills.mockResolvedValue([TOW_BILL]);
  const renderer = await mount();
  try {
    const row = pressable(renderer, `${en.bills.journey} 370,000 VND`);
    expect(row).toBeDefined();
    await act(async () => {
      row?.props.onPress?.();
    });
    expect(mockNavigate).toHaveBeenCalledWith("BillDetail", {ticketId: "tow1"});
  } finally {
    renderer.unmount();
  }
});
