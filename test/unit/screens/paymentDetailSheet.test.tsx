import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import PaymentDetailSheet from "../../../src/screens/bills/PaymentDetailSheet";
import {en} from "../../../src/i18n/en";
import type {Bill} from "../../../src/api/bills";
import type {FeedTicket} from "../../../src/api/dispatch";

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

async function mount() {
  mockFetchBill.mockResolvedValue(EMPTY_BILL);
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PaymentDetailSheet ticketId="t1" ticket={TICKET} onClose={() => undefined} />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

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
