import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import BillStrip from "../../../src/screens/assist/BillStrip";
import {en} from "../../../src/i18n/en";
import {lightTheme} from "../../../src/theme";
import type {Bill} from "../../../src/api/bills";

function bill(overrides?: Partial<Bill>): Bill {
  return {
    billId: "tow1",
    ticketId: "tow1",
    ticketType: "TOW",
    ticketStatus: "4",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "VND",
    total: 220000,
    paid: 120000,
    due: 100000,
    status: "PARTIAL",
    viewer: "RIDER",
    canPay: true,
    items: [],
    ...overrides,
  } as Bill;
}

async function render(bills: Bill[], dueCount: number, dueTotal: number, onOpen = jest.fn()) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<BillStrip t={en} theme={lightTheme} bills={bills} dueCount={dueCount} dueTotal={dueTotal} onOpen={onOpen} />);
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onOpen};
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

test("hidden while there are no bills", async () => {
  const {renderer} = await render([], 0, 0);
  try {
    expect(renderer.toJSON()).toBeNull();
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("single due bill carries the amount and opens bills", async () => {
  const {renderer, onOpen} = await render([bill()], 1, 100000);
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.dueOne);
    expect(all).toContain(en.bills.outstanding.replace("{amount}", "100,000"));
    expect(all).toContain(en.bills.view);
    const pressable = renderer.root.findAll((n) => typeof n.props?.onPress === "function")[0];
    await act(async () => {
      pressable?.props.onPress?.();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("several due bills pluralize the strip", async () => {
  const {renderer} = await render([bill(), bill({billId: "w2", ticketId: "w2", due: 40000})], 2, 140000);
  try {
    expect(texts(renderer)).toContain(en.bills.dueMany.replace("{n}", "2"));
    expect(texts(renderer)).toContain(en.bills.outstanding.replace("{amount}", "140,000"));
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("settled bills show the quiet strip", async () => {
  const settled = bill({due: 0, paid: 220000, status: "PAID"});
  const {renderer, onOpen} = await render([settled], 0, 0);
  try {
    const all = texts(renderer);
    expect(all).toContain(en.bills.title);
    expect(all).toContain(en.bills.allSettled);
    const pressable = renderer.root.findAll((n) => typeof n.props?.onPress === "function")[0];
    expect(pressable).toBeDefined();
    await act(async () => {
      pressable?.props.onPress?.();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});
