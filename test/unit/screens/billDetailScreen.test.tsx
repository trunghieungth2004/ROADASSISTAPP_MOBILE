import {expect, jest, test, beforeEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Linking, Text} from "react-native";
import BillDetailScreen from "../../../src/screens/BillDetailScreen";
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
  useAppMode: () => "light" as const,
}));

let mockParams: {ticketId?: string; billId?: string; payFirst?: boolean; readOnly?: boolean; scope?: "payee"} = {ticketId: "tow1"};

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({navigate: jest.fn(), setOptions: () => undefined}),
    useRoute: () => ({params: mockParams}),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
  };
});

const mockFetchBill = jest.fn(async () => null as unknown as Bill);
const mockCreatePayment = jest.fn(async () => ({checkoutUrl: null}) as unknown);
const mockConfirmCashReceipt = jest.fn(async () => ({}) as unknown);

jest.mock("../../../src/api/bills", () => ({
  fetchBill: (...args: unknown[]) => (mockFetchBill as (...a: unknown[]) => Promise<Bill>)(...args),
}));

jest.mock("../../../src/api/dispatch", () => ({
  createPayment: (...args: unknown[]) => (mockCreatePayment as (...a: unknown[]) => Promise<unknown>)(...args),
  confirmCashReceipt: (...args: unknown[]) => (mockConfirmCashReceipt as (...a: unknown[]) => Promise<unknown>)(...args),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const UNPAID_BILL: Bill = {
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
    {kind: "TOW_FARE", ticketId: "tow1", ticketType: "TOW", ticketStatus: "4", amount: 220000, waitingFee: 20000, status: "UNPAID", payeeId: "op1", payeeName: "Tow Co", qrUrl: null, payment: null},
    {kind: "REPAIR", ticketId: "walk1", ticketType: "WALK_IN", ticketStatus: "9", amount: 150000, waitingFee: 0, status: "UNPAID", payeeId: "op2", payeeName: "Fix Shop", qrUrl: null, payment: null},
  ],
};

const ARMED_BILL: Bill = {
  ...UNPAID_BILL,
  paid: 150000,
  due: 220000,
  status: "PARTIAL",
  items: [
    {kind: "TOW_FARE", ticketId: "tow1", ticketType: "TOW", ticketStatus: "4", amount: 220000, waitingFee: 20000, status: "PENDING", payeeId: "op1", payeeName: "Tow Co", qrUrl: "https://pay.example/qr1", payment: {id: "p1", method: "SEPAY", status: "PENDING", amount: 220000, refundAmount: null, commissionRate: null, commissionAmount: null, payoutAmount: null, payoutRef: null, payoutAt: null, payoutStatus: "NONE", canConfirmCash: false}},
    {kind: "REPAIR", ticketId: "walk1", ticketType: "WALK_IN", ticketStatus: "9", amount: 150000, waitingFee: 0, status: "PAID", payeeId: "op2", payeeName: "Fix Shop", qrUrl: null, payment: {id: "p2", method: "CASH", status: "CONFIRMED", amount: 150000, refundAmount: null, commissionRate: 10, commissionAmount: 15000, payoutAmount: 135000, payoutRef: null, payoutAt: null, payoutStatus: "PENDING", canConfirmCash: false}},
  ],
};

const CASH_PENDING_BILL: Bill = {
  ...ARMED_BILL,
  items: [
    ARMED_BILL.items[0],
    {...ARMED_BILL.items[1], status: "PENDING", payment: {id: "p2", method: "CASH", status: "PENDING", amount: 150000, refundAmount: null, commissionRate: null, commissionAmount: null, payoutAmount: null, payoutRef: null, payoutAt: null, payoutStatus: "NONE", canConfirmCash: false}},
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
    {...ARMED_BILL.items[1], payeeId: "u1", payeeName: "Fix Shop"},
  ],
};

const CASH_PAYEE_BILL: Bill = {
  ...PAYEE_BILL,
  paid: 0,
  due: 150000,
  status: "UNPAID",
  items: [
    {
      ...PAYEE_BILL.items[0],
      status: "PENDING",
      payment: {id: "p2", method: "CASH", status: "PENDING", amount: 150000, refundAmount: null, commissionRate: null, commissionAmount: null, payoutAmount: null, payoutRef: null, payoutAt: null, payoutStatus: "NONE", canConfirmCash: true},
    },
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
        <BillDetailScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockParams = {ticketId: "tow1"};
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValue(UNPAID_BILL);
  mockCreatePayment.mockReset();
  mockCreatePayment.mockResolvedValue({checkoutUrl: null});
  mockConfirmCashReceipt.mockReset();
  mockConfirmCashReceipt.mockResolvedValue({});
});

test("bill detail itemizes the journey", async () => {
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.journey);
    expect(all).toContain(en.bills.towFare);
    expect(all).toContain(en.bills.repair);
    expect(all).toContain("220,000 VND");
    expect(all).toContain(`${en.bills.waiting}: 20,000 VND`);
    expect(all).toContain("370,000 VND");
    expect(all).toContain(en.bills.statusUnpaid);
    expect(mockFetchBill).toHaveBeenCalledWith("tok", {ticketId: "tow1"});
  } finally {
    renderer.unmount();
  }
});

test("paying a sepay item arms it and opens checkout", async () => {
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValueOnce(UNPAID_BILL).mockResolvedValue(ARMED_BILL);
  mockCreatePayment.mockResolvedValue({checkoutUrl: "https://pay.example/checkout"});
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  open.mockClear();
  const renderer = await mount();
  try {
    const pay = pressable(renderer, `${en.bills.paySepay} ${en.bills.repair}`);
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("walk1", "SEPAY", "tok");
    expect(open).toHaveBeenCalledWith("https://pay.example/checkout");
    expect(texts(renderer)).toContain(en.bills.itemPending);
  } finally {
    renderer.unmount();
  }
});

test("paying a cash item arms it without a checkout", async () => {
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValueOnce(UNPAID_BILL).mockResolvedValue(CASH_PENDING_BILL);
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  open.mockClear();
  const renderer = await mount();
  try {
    const pay = pressable(renderer, `${en.bills.payCash} ${en.bills.repair}`);
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("walk1", "CASH", "tok");
    expect(open).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain(en.bills.cashArmed);
  } finally {
    renderer.unmount();
  }
});

test("an armed sepay item reopens its payment page", async () => {
  mockFetchBill.mockResolvedValue(ARMED_BILL);
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  open.mockClear();
  const renderer = await mount();
  try {
    const button = pressable(renderer, en.bills.openQr);
    expect(button).toBeDefined();
    await act(async () => {
      button?.props.onPress?.();
    });
    expect(open).toHaveBeenCalledWith("https://pay.example/qr1");
  } finally {
    renderer.unmount();
  }
});

test("the bill explains why an approval was blocked", async () => {
  mockParams = {ticketId: "tow1", payFirst: true};
  const renderer = await mount();
  try {
    expect(texts(renderer)).toContain(en.bills.payFirst);
  } finally {
    renderer.unmount();
  }
});

test("a read-only bill hides payment actions", async () => {
  mockParams = {ticketId: "tow1", readOnly: true};
  const renderer = await mount();
  try {
    expect(texts(renderer)).toContain(en.bills.readOnly);
    expect(pressable(renderer, `${en.bills.paySepay} ${en.bills.towFare}`)).toBeUndefined();
    expect(pressable(renderer, `${en.bills.payCash} ${en.bills.towFare}`)).toBeUndefined();
    expect(pressable(renderer, `${en.bills.paySepay} ${en.bills.repair}`)).toBeUndefined();
    expect(pressable(renderer, `${en.bills.payCash} ${en.bills.repair}`)).toBeUndefined();
  } finally {
    renderer.unmount();
  }
});

test("a read-only bill hides the payment page and pay-first banner", async () => {
  mockParams = {ticketId: "tow1", payFirst: true, readOnly: true};
  mockFetchBill.mockResolvedValue(ARMED_BILL);
  const renderer = await mount();
  try {
    expect(texts(renderer)).not.toContain(en.bills.payFirst);
    expect(texts(renderer)).toContain(en.bills.readOnly);
    expect(pressable(renderer, en.bills.openQr)).toBeUndefined();
  } finally {
    renderer.unmount();
  }
});

test("a payee bill shows only their item and payout", async () => {
  mockParams = {ticketId: "walk1", scope: "payee"};
  mockFetchBill.mockResolvedValue(PAYEE_BILL);
  const renderer = await mount();
  try {
    expect(mockFetchBill).toHaveBeenCalledWith("tok", {ticketId: "walk1", scope: "payee"});
    const all = texts(renderer);
    expect(all).toContain(en.payments.payeeOnly);
    expect(all).toContain(en.payments.commission);
    expect(all).toContain("15,000 VND");
    expect(all).toContain(en.payments.netPayout);
    expect(all).toContain("135,000 VND");
    expect(all).toContain(en.payments.payoutPending);
    expect(all).toContain(en.bills.repair);
    expect(all).not.toContain(en.bills.towFare);
    expect(pressable(renderer, `${en.bills.paySepay} ${en.bills.repair}`)).toBeUndefined();
    expect(pressable(renderer, `${en.bills.payCash} ${en.bills.repair}`)).toBeUndefined();
  } finally {
    renderer.unmount();
  }
});

test("a payee confirms cash from the scoped bill", async () => {
  mockParams = {ticketId: "walk1", scope: "payee"};
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValueOnce(CASH_PAYEE_BILL).mockResolvedValue(PAYEE_BILL);
  const renderer = await mount();
  try {
    const confirm = pressable(renderer, `${en.assist.cashConfirmReceipt} ${en.bills.repair}`);
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm?.props.onPress?.();
      await flush();
    });
    expect(mockConfirmCashReceipt).toHaveBeenCalledWith("walk1", "tok");
    expect(texts(renderer)).toContain(en.bills.itemPaid);
    expect(texts(renderer)).toContain(en.payments.payoutPending);
  } finally {
    renderer.unmount();
  }
});

test("a read-only payee bill hides cash confirmation", async () => {
  mockParams = {ticketId: "walk1", scope: "payee", readOnly: true};
  mockFetchBill.mockResolvedValue(CASH_PAYEE_BILL);
  const renderer = await mount();
  try {
    expect(texts(renderer)).toContain(en.bills.readOnly);
    expect(pressable(renderer, `${en.assist.cashConfirmReceipt} ${en.bills.repair}`)).toBeUndefined();
  } finally {
    renderer.unmount();
  }
});
