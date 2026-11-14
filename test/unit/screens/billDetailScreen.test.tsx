import {expect, jest, test, beforeEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Alert, Text} from "react-native";
import BillDetailScreen from "../../../src/screens/BillDetailScreen";
import {en} from "../../../src/i18n/en";
import type {Bill} from "../../../src/api/bills";
import {billDateTimeLabel} from "../../../src/screens/bills/billLabels";

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
const mockFetchTicketPayments = jest.fn(async () => [] as unknown[]);
const mockCancelPayment = jest.fn(async () => ({cancelled: true, method: "SEPAY"}));

jest.mock("../../../src/api/bills", () => ({
  fetchBill: (...args: unknown[]) => (mockFetchBill as (...a: unknown[]) => Promise<Bill>)(...args),
}));

jest.mock("../../../src/api/dispatch", () => {
  const actual = jest.requireActual("../../../src/api/dispatch") as Record<string, unknown>;
  return {
    ...actual,
    createPayment: (...args: unknown[]) => (mockCreatePayment as (...a: unknown[]) => Promise<unknown>)(...args),
    confirmCashReceipt: (...args: unknown[]) => (mockConfirmCashReceipt as (...a: unknown[]) => Promise<unknown>)(...args),
    fetchTicketPayments: (...args: unknown[]) => (mockFetchTicketPayments as (...a: unknown[]) => Promise<unknown[]>)(...args),
    cancelPayment: (...args: unknown[]) => (mockCancelPayment as (...a: unknown[]) => Promise<unknown>)(...args),
  };
});

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
  total: 220000,
  paid: 0,
  due: 220000,
  status: "UNPAID",
  viewer: "RIDER",
  canPay: true,
  items: [
    {kind: "TOW_FARE", ticketId: "tow1", ticketType: "TOW", ticketStatus: "4", amount: 220000, waitingFee: 20000, status: "UNPAID", payeeId: "op1", payeeName: "Tow Co", qrUrl: null, payment: null,
      baseFee: 200000, perKmFee: 10000, includedKm: 10, billableKm: 1.01,
      distanceKm: 11.01, totalDistanceKm: 20.94, ceiling: 242000, night: false, nightMultiplier: 1.5, vehicleClass: "SOLO_BIKE",
      pickup: {lat: 10.7, lng: 106.6},
      destination: {lat: 10.75, lng: 106.7, shopId: "shop1", name: "Fix Shop", label: "12 Nguyen Trai"},
      breakdown: [
        {code: "BASE", label: "Base fare", amount: 200000, detail: null},
        {code: "DISTANCE", label: "Distance", amount: 0, detail: null},
        {code: "WAITING", label: "Waiting", amount: 20000, detail: "5 min"},
      ]},
  ],
};

const SINGLE_REPAIR_UNPAID: Bill = {
  billId: "walk1",
  ticketId: "walk1",
  ticketType: "WALK_IN",
  ticketStatus: "9",
  createdAt: "2026-10-03T10:00:00.000Z",
  currency: "VND",
  total: 150000,
  paid: 0,
  due: 150000,
  status: "UNPAID",
  viewer: "RIDER",
  canPay: true,
  items: [
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

const CANCELLED_CASH_BILL: Bill = {
  ...UNPAID_BILL,
  ticketStatus: "5",
  total: 50000,
  paid: 0,
  due: 50000,
  items: [{
    ...UNPAID_BILL.items[0],
    ticketStatus: "5",
    amount: 50000,
    waitingFee: 0,
    status: "PENDING",
    breakdown: [{code: "PRIOR_TOW", label: "Prior tower travel", amount: 50000, detail: "7.50 km · Old Tow"}],
    payment: {id: "p2", method: "CASH", status: "PENDING", amount: 50000, refundAmount: null, commissionRate: null, commissionAmount: null, payoutAmount: null, payoutRef: null, payoutAt: null, payoutStatus: "NONE", canConfirmCash: false},
  }],
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

const REFUND_BILL: Bill = {
  ...ARMED_BILL,
  items: [{
    ...ARMED_BILL.items[0],
    refundRequest: {
      id: "rf1",
      status: "REQUESTED",
      amount: 50000,
      transferRef: "TRX1",
      requestedAt: "2026-10-04T12:00:00.000Z",
    },
  }],
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
  mockFetchTicketPayments.mockReset();
  mockFetchTicketPayments.mockResolvedValue([]);
  mockCancelPayment.mockReset();
  mockCancelPayment.mockResolvedValue({cancelled: true, method: "SEPAY"});
  mockConfirmCashReceipt.mockResolvedValue({});
});

test("bill detail itemizes the journey", async () => {
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.towFare);
    expect(all).toContain("220,000 VND");
    expect(all).toContain(en.bills.waiting);
    expect(all).toContain("20,000 VND");
    expect(all).toContain(en.bills.statusUnpaid);
    expect(mockFetchBill).toHaveBeenCalledWith("tok", {ticketId: "tow1"});
  } finally {
    renderer.unmount();
  }
});

test("shows the TOW coverage, fare cap, parties and bill time", async () => {
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.pickup);
    expect(all).toContain(en.assist.dropOffPoint);
    expect(all.join(" ")).toContain("12 Nguyen Trai");
    expect(all).not.toContain("Fix Shop");
    expect(all).toContain(en.bills.includedFirstKm.replace("{km}", "10"));
    expect(all.join(" ")).toContain(en.bills.loadedDistance);
    expect(all.join(" ")).toContain("11.01 km");
    expect(all.join(" ")).toContain(en.bills.fareCap);
    expect(all.join(" ")).toContain("242,000 VND");
    expect(all.join(" ")).not.toContain(en.bills.baseFareCovers.replace("{km}", "10"));
    expect(all.join(" ")).not.toContain(en.bills.baseFareExcludes.replace("{km}", "10"));
    expect(all.join(" ")).not.toContain(en.bills.fareCapHint);
    expect(all.join(" ")).toContain(billDateTimeLabel(UNPAID_BILL.createdAt));
  } finally {
    renderer.unmount();
  }
});

test("a repair bill has no pickup or drop-off row", async () => {
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValue(SINGLE_REPAIR_UNPAID);
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).not.toContain(en.assist.pickup);
    expect(all).not.toContain(en.assist.dropOffPoint);
  } finally {
    renderer.unmount();
  }
});

test("a partial tow labels the traveled distance as deadhead", async () => {
  const partial: Bill = {
    ...UNPAID_BILL,
    total: 32000,
    paid: 0,
    due: 32000,
    status: "UNPAID",
    items: [{
      ...UNPAID_BILL.items[0],
      amount: 32000,
      distanceKm: 3.2,
      breakdown: [{code: "TRAVELED", label: "Traveled distance", amount: 32000, detail: "3.20 km"}],
    }],
  };
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValue(partial);
  const renderer = await mount();
  try {
    const all = texts(renderer).join(" ");
    expect(all).toContain(`${en.bills.deadheadDistance}: 3.20 km`);
    expect(all).not.toContain(en.bills.loadedDistance);
  } finally {
    renderer.unmount();
  }
});

test("an SOS bill keeps travel detail and hides vehicle, kind and addresses", async () => {
  const sos: Bill = {
    billId: "sos1",
    ticketId: "sos1",
    ticketType: "SOS",
    ticketStatus: "4",
    createdAt: "2026-10-03T10:00:00.000Z",
    currency: "VND",
    total: 90000,
    paid: 0,
    due: 90000,
    status: "UNPAID",
    viewer: "RIDER",
    canPay: true,
    items: [
      {
        kind: "REPAIR",
        ticketId: "sos1",
        ticketType: "SOS",
        ticketStatus: "4",
        amount: 90000,
        waitingFee: 0,
        serviceType: "SOS",
        rider: {uid: "u1", name: "Rider One", phone: "0900000001"},
        provider: {id: "mobile1", name: "Mobile Shop", kind: "MOBILE_SHOP", phone: "0900000002", label: null},
        vehicleLabel: "Toyota",
        vehiclePlate: "65-X1 12455",
        pickup: {lat: 10.7, lng: 106.6},
        destination: {lat: 10.75, lng: 106.7, shopId: "mobile1", name: "Mobile Shop", label: "12 Nguyen Trai"},
        breakdown: [{code: "TRAVEL", label: "Travel", amount: 40000, detail: "8.00 km × 5.000 ₫/km"}],
        status: "UNPAID",
        payeeId: "op1",
        payeeName: "Mobile Shop",
        qrUrl: null,
        payment: null,
      },
    ],
  };
  mockParams = {ticketId: "sos1"};
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValue(sos);
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all.join(" ")).toContain("8.00 km × 5.000 ₫/km");
    expect(all).toContain("Rider One");
    expect(all).toContain("Mobile Shop");
    expect(all).not.toContain("MOBILE_SHOP");
    expect(all.join(" ")).not.toContain("Toyota");
    expect(all.join(" ")).not.toContain("65-X1 12455");
    expect(all).not.toContain(en.assist.pickup);
    expect(all).not.toContain(en.assist.dropOffPoint);
    expect(all.join(" ")).not.toContain("12 Nguyen Trai");
  } finally {
    renderer.unmount();
  }
});

test("paying a sepay item arms it and opens checkout", async () => {
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValueOnce(SINGLE_REPAIR_UNPAID).mockResolvedValue(ARMED_BILL);
  mockCreatePayment.mockResolvedValue({checkoutUrl: "https://pay.example/checkout"});
  const renderer = await mount();
  try {
    const pay = pressable(renderer, en.bills.paySepay);
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("walk1", "SEPAY", "tok");
    const webview = renderer.root.findByProps({testID: "sepay-webview"});
    expect(webview.props.source).toEqual({uri: "https://pay.example/checkout"});
    expect(texts(renderer)).toContain(en.bills.itemPending);
  } finally {
    renderer.unmount();
  }
});

test("a pending SePay item can switch to cash", async () => {
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValue(ARMED_BILL);
  mockCreatePayment.mockResolvedValue({checkoutUrl: null});
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
  const renderer = await mount();
  try {
    const cash = pressable(renderer, en.bills.payCash);
    expect(cash).toBeDefined();
    await act(async () => {
      cash?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("tow1", "CASH", "tok");
    expect(texts(renderer)).toContain(en.bills.cashArmed);
  } finally {
    alert.mockRestore();
    renderer.unmount();
  }
});

test("SePay page cancel cancels the pending charge", async () => {
  mockFetchBill.mockResolvedValue(ARMED_BILL);
  mockCreatePayment.mockResolvedValue({checkoutUrl: "https://pay.example/cancel"});
  const renderer = await mount();
  try {
    const open = pressable(renderer, en.bills.openQr);
    expect(open).toBeDefined();
    await act(async () => {
      open?.props.onPress?.();
      await flush();
    });
    const webview = renderer.root.findByProps({testID: "sepay-webview"});
    await act(async () => {
      webview.props.onShouldStartLoadWithRequest({
        url: "https://roadassistapp-c2e37.web.app/?payment=cancel",
      });
      await flush();
    });
    expect(mockCancelPayment).toHaveBeenCalledWith("tow1", "tok");
    expect(renderer.root.findAllByProps({testID: "sepay-webview"})).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("paying a cash item arms it without a checkout", async () => {
  mockFetchBill.mockReset();
  mockFetchBill.mockResolvedValueOnce(SINGLE_REPAIR_UNPAID).mockResolvedValue(CASH_PENDING_BILL);
  const renderer = await mount();
  try {
    const pay = pressable(renderer, en.bills.payCash);
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("walk1", "CASH", "tok");
    expect(texts(renderer)).toContain(en.bills.cashArmed);
  } finally {
    renderer.unmount();
  }
});

test("a cancelled tow offers online payment for a pending cash charge", async () => {
  mockFetchBill.mockResolvedValue(CANCELLED_CASH_BILL);
  mockCreatePayment.mockResolvedValue({checkoutUrl: "https://pay.example/cancel"});
  const renderer = await mount();
  try {
    expect(texts(renderer)).toContain(en.bills.cancellationCashHint);
    expect(texts(renderer)).toContain("7.50 km · Old Tow");
    const pay = pressable(renderer, en.bills.payCancellation);
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("tow1", "SEPAY", "tok");
  } finally {
    renderer.unmount();
  }
});

test("an armed sepay item refreshes its payment page", async () => {
  mockFetchBill.mockResolvedValue(ARMED_BILL);
  mockCreatePayment.mockResolvedValue({checkoutUrl: "https://pay.example/fresh"});
  mockCreatePayment.mockClear();
  const renderer = await mount();
  try {
    const button = pressable(renderer, en.bills.openQr);
    expect(button).toBeDefined();
    await act(async () => {
      button?.props.onPress?.();
      await flush();
    });
    expect(mockCreatePayment).toHaveBeenCalledWith("tow1", "SEPAY", "tok");
    const webview = renderer.root.findByProps({testID: "sepay-webview"});
    expect(webview.props.source).toEqual({uri: "https://pay.example/fresh"});
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
    expect(pressable(renderer, en.bills.paySepay)).toBeUndefined();
    expect(pressable(renderer, en.bills.payCash)).toBeUndefined();
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

test("shows the refund status and why the bill remains paid", async () => {
  mockFetchBill.mockResolvedValue(REFUND_BILL);
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.refund);
    expect(all).toContain(en.payments.refundStatusREQUESTED);
    expect(all.some((value) => value.startsWith("50,000 VND · "))).toBe(true);
    expect(all).toContain(`${en.payments.refundTransferRef}: TRX1`);
    expect(all).toContain(en.payments.refundPaidNote);
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
    expect(pressable(renderer, en.bills.paySepay)).toBeUndefined();
    expect(pressable(renderer, en.bills.payCash)).toBeUndefined();
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
    const confirm = pressable(renderer, en.assist.cashConfirmReceipt);
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
    expect(pressable(renderer, en.assist.cashConfirmReceipt)).toBeUndefined();
  } finally {
    renderer.unmount();
  }
});
