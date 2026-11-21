import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {Text} from "react-native";
import FeesCard from "../../../../src/screens/assist/detail/FeesCard";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";
import type {FeedTicket} from "../../../../src/api/dispatch";

function shown(renderer: ReturnType<typeof create>): string {
  return renderer.root.findAllByType(Text)
    .map((node) => {
      const children = node.props.children as unknown;
      return Array.isArray(children) ? children.join("") : String(children ?? "");
    })
    .join(" ");
}

async function renderCard(ticket: FeedTicket): Promise<ReturnType<typeof create>> {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <FeesCard
        t={en}
        theme={lightTheme}
        ticket={ticket}
        bill={null}
        busy={false}
        payable={false}
        waitingFee={null}
        estimateAmount={null}
        estimateNote={null}
        estimateState="none"
        onApproveEstimate={null}
        onDeclineEstimate={null}
        onApproveFinal={null}
        payMethod={null}
        payStatus={null}
        onConfirmCash={null}
        onOpenBill={null}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

async function unmount(renderer: ReturnType<typeof create>): Promise<void> {
  await act(async () => {
    renderer.unmount();
  });
}

test("SOS visit fees show call-out, travel distance, and total", async () => {
  const ticket = {
    id: "t1",
    ticketType: "SOS",
    status: "2",
    direction: "out",
    assignedShopId: "shop1",
    mobileCallOutFee: 50000,
    mobileTravelFee: 12000,
    mobileTravelKm: 1.2,
    mobileTravelRate: 10000,
  } as unknown as FeedTicket;
  const renderer = await renderCard(ticket);
  try {
    const text = shown(renderer);
    expect(text).toContain(en.assist.visitFees);
    expect(text).toContain(en.assist.mobileCallOut);
    expect(text).toContain("50,000 VND");
    expect(text).toContain("12,000 VND");
    expect(text).toContain("1.2 km × 10,000");
    expect(text).toContain(en.assist.visitEstimate);
    expect(text).toContain("62,000 VND");
    expect(text).toContain(en.assist.visitRepairQuoted);
    expect(text).toContain(en.assist.visitUnfixable);
  } finally {
    await unmount(renderer);
  }
});

test("waived SOS call-out is labelled instead of showing zero", async () => {
  const ticket = {
    id: "t2",
    ticketType: "SOS",
    status: "2",
    direction: "out",
    assignedShopId: "shop1",
    mobileCallOutFee: 0,
    mobileCallOutWaived: true,
    mobileTravelFee: 8000,
    mobileTravelKm: 0.8,
    mobileTravelRate: 10000,
  } as unknown as FeedTicket;
  const renderer = await renderCard(ticket);
  try {
    const text = shown(renderer);
    expect(text).toContain(en.assist.waived);
    expect(text).not.toMatch(/\b0 VND/);
    expect(text).toContain("8,000 VND");
  } finally {
    await unmount(renderer);
  }
});

test("adds the current visit fees to the repair total", async () => {
  const ticket = {
    id: "t3",
    ticketType: "SOS",
    status: "7",
    direction: "out",
    assignedShopId: "shop1",
    mobileCallOutFee: 50000,
    mobileTravelFee: 12000,
    mobileTravelKm: 1.2,
    mobileTravelRate: 10000,
    finalAmount: 300000,
  } as unknown as FeedTicket;
  const renderer = await renderCard(ticket);
  try {
    const text = shown(renderer);
    expect(text).toContain(en.bills.total);
    expect(text).toContain("362,000 VND");
  } finally {
    await unmount(renderer);
  }
});

test("hides the visit breakdown once the vehicle is unfixable", async () => {
  const ticket = {
    id: "t4",
    ticketType: "SOS",
    status: "15",
    direction: "out",
    assignedShopId: "shop1",
    mobileCallOutFee: 50000,
    mobileTravelFee: 12000,
    mobileTravelKm: 1.2,
    mobileTravelRate: 10000,
  } as unknown as FeedTicket;
  const renderer = await renderCard(ticket);
  try {
    const text = shown(renderer);
    expect(text).not.toContain(en.assist.visitFees);
    expect(text).toContain("50,000 VND");
    expect(text).not.toContain("62,000 VND");
  } finally {
    await unmount(renderer);
  }
});
