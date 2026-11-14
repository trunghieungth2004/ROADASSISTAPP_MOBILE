import {beforeEach, expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import PaymentDetailSheet from "../../../src/screens/bills/PaymentDetailSheet";
import {en} from "../../../src/i18n/en";
import type {Bill} from "../../../src/api/bills";
import {createPayment, type FeedTicket} from "../../../src/api/dispatch";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok"}),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {useStrings: () => ({t: mockedEn, lang: "en"})};
});

jest.mock("../../../src/context/ThemeContext", () => ({
  useAppMode: () => "light",
}));

jest.mock("../../../src/context/BillsContext", () => ({
  useBills: () => ({refresh: jest.fn()}),
}));

const mockFetchBill = jest.fn(async () => null as unknown as Bill);
jest.mock("../../../src/api/bills", () => ({
  fetchBill: (...args: unknown[]) => (mockFetchBill as (...a: unknown[]) => Promise<Bill>)(...args),
  requestInvoice: jest.fn(),
}));

jest.mock("../../../src/api/dispatch", () => {
  const actual = jest.requireActual("../../../src/api/dispatch") as Record<string, unknown>;
  return {
    ...actual,
    confirmCashReceipt: jest.fn(),
    createPayment: jest.fn(),
  };
});

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const EMPTY_BILL: Bill = {
  billId: "t1",
  ticketId: "t1",
  ticketType: "TOW",
  ticketStatus: "2",
  createdAt: "2026-01-01T00:00:00.000Z",
  currency: "VND",
  total: 0,
  paid: 0,
  due: 0,
  status: "VOID",
  viewer: "RIDER",
  canPay: true,
  items: [],
};

const CANCELLED_CASH_BILL: Bill = {
  billId: "tow1",
  ticketId: "tow1",
  ticketType: "TOW",
  ticketStatus: "5",
  createdAt: "2026-01-01T00:00:00.000Z",
  currency: "VND",
  total: 50000,
  paid: 0,
  due: 50000,
  status: "UNPAID",
  viewer: "RIDER",
  canPay: true,
  items: [{
    kind: "TOW_FARE",
    ticketId: "tow1",
    ticketType: "TOW",
    ticketStatus: "5",
    amount: 50000,
    waitingFee: 0,
    status: "PENDING",
    payeeId: "op1",
    payeeName: "Tow Co",
    qrUrl: null,
    breakdown: [{code: "PRIOR_TOW", label: "Prior tower travel", amount: 50000, detail: "7.50 km · Old Tow"}],
    payment: {
      id: "p1",
      method: "CASH",
      status: "PENDING",
      amount: 50000,
      refundAmount: null,
      commissionRate: null,
      commissionAmount: null,
      payoutAmount: null,
      payoutRef: null,
      payoutAt: null,
      payoutStatus: "NONE",
      canConfirmCash: false,
    },
  }],
};

const TICKET = {
  id: "t1",
  ticketType: "TOW",
  lat: 10.71,
  lng: 106.61,
  status: "2",
  direction: "out",
  towFare: {
    estimate: 300000,
    ceiling: 330000,
    deadheadKm: 1,
    loadedKm: 8.15,
    night: false,
    vehicleClass: "CAR",
    baseFee: 300000,
    perKmFee: 10000,
    includedKm: 10,
    billableKm: 0,
  },
} as unknown as FeedTicket;

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function mount(bill: Bill = EMPTY_BILL, ticket: FeedTicket = TICKET) {
  mockFetchBill.mockResolvedValue(bill);
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PaymentDetailSheet ticketId={bill.ticketId} ticket={ticket} onClose={() => undefined} />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  jest.mocked(createPayment).mockReset();
});

test("a delivered tow lets the rider switch pending cash to online", async () => {
  jest.mocked(createPayment).mockResolvedValue({checkoutUrl: "https://pay.example/tow"} as never);
  const bill: Bill = {
    ...CANCELLED_CASH_BILL,
    ticketStatus: "4",
    items: CANCELLED_CASH_BILL.items.map((item) => ({...item, ticketStatus: "4"})),
  };
  const renderer = await mount(bill, {...TICKET, status: "4"} as FeedTicket);
  try {
    const pay = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.bills.paySepay &&
      typeof node.props?.onPress === "function")[0];
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress();
      await flush();
    });
    expect(createPayment).toHaveBeenCalledWith("tow1", "SEPAY", "tok");
  } finally {
    renderer.unmount();
  }
});

test("a cancelled tow lets the rider pay a pending cash charge online", async () => {
  jest.mocked(createPayment).mockResolvedValue({checkoutUrl: "https://pay.example/cancel"} as never);
  const renderer = await mount(CANCELLED_CASH_BILL, {...TICKET, status: "5"} as FeedTicket);
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.cancellationCashHint);
    expect(all).toContain("7.50 km · Old Tow");
    const pay = renderer.root.findAll((node) =>
      node.props?.accessibilityLabel === en.bills.payCancellation &&
      typeof node.props?.onPress === "function")[0];
    expect(pay).toBeDefined();
    await act(async () => {
      pay?.props.onPress();
      await flush();
    });
    expect(createPayment).toHaveBeenCalledWith("tow1", "SEPAY", "tok");
  } finally {
    renderer.unmount();
  }
});

test("an active tow shows a fare preview before a bill exists", async () => {
  const renderer = await mount();
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.farePreviewTitle);
    expect(all).toContain(en.assist.fareUpTo);
    expect(all).toContain("330,000 VND");
    expect(all).toContain("300,000 VND");
    expect(all).toContain("10 km");
    expect(all).toContain("8.15 km");
    expect(all).toContain("0.00 km");
    expect(all).toContain("10,000 VND/km");
    expect(all).toContain(en.assist.farePreviewHint);
  } finally {
    renderer.unmount();
  }
});
