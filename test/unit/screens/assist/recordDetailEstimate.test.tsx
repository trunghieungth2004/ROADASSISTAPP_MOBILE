import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RecordDetailSheet from "../../../../src/screens/assist/RecordDetailSheet";
import {en} from "../../../../src/i18n/en";
import type {FeedTicket} from "../../../../src/api/dispatch";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof RecordDetailSheet>;

function ticket(overrides?: Partial<FeedTicket>): FeedTicket {
  return {
    id: "t1",
    ticketType: "TOW",
    lat: 10.71,
    lng: 106.61,
    status: "2",
    direction: "in",
    destinationShopId: "shop-1",
    otherParty: {name: "Rider", kind: "RIDER"},
    ...overrides,
  } as FeedTicket;
}

async function render(overrides?: Partial<Props>) {
  const onOpenEstimate = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <RecordDetailSheet
          t={en}
          lang="en"
          ticket={ticket()}
          ratings={[]}
          busy={false}
          uid="u1"
          hasRated={false}
          onClose={() => undefined}
          onConfirmCancel={() => undefined}
          onRate={() => undefined}
          onAccept={() => undefined}
          onDecline={() => undefined}
          onOpenWork={() => undefined}
          onOpenQuote={() => undefined}
          onOpenEstimate={onOpenEstimate}
          onApproveQuote={() => undefined}
          onOpenShop={() => undefined}
          onOpenDestination={() => undefined}
          onNavigateJob={null}
          acceptHidden={false}
          acceptOffDuty={false}
          towPreview={null}
          onPreviewTowRoute={null}
          linked={null}
          onOpenLinked={() => undefined}
          onAdvance={() => undefined}
          onReply={() => undefined}
          onRateRider={() => undefined}
          ownShopIds={new Set(["shop-1"])}
          ownTowId={null}
          hasVolunteer={false}
          showRequestPhotos
          onDeclineDestination={() => undefined}
          onEditDestination={null}
          allowTowerCancel={false}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onOpenEstimate};
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

function actionLabels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string" && n.props?.accessibilityRole === "button")
    .map((n) => n.props.accessibilityLabel as string);
}

function inputByPlaceholder(renderer: ReturnType<typeof create>, placeholder: string) {
  return renderer.root
    .findAll((n) => n.props?.placeholder === placeholder && typeof n.props?.onChangeText === "function");
}

function tap(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root
    .findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function")
    .pop();
}

test("destination shop gets the estimate call to action on a live tow", async () => {
  const {renderer} = await render();
  try {
    expect(actionLabels(renderer)).toContain(en.assist.sendEstimate);
  } finally {
    renderer.unmount();
  }
});

test("the call to action opens the estimate sheet", async () => {
  const {renderer, onOpenEstimate} = await render();
  try {
    const chip = tap(renderer, en.assist.sendEstimate);
    await act(async () => {
      chip?.props.onPress?.();
    });
    expect(onOpenEstimate).toHaveBeenCalledTimes(1);
    expect(inputByPlaceholder(renderer, en.assist.estimateAmount)).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("the call to action hides while an estimate is live or approved", async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const cases: Partial<FeedTicket>[] = [
    {estimateAmount: 150000, estimateExpiresAt: future},
    {estimateAmount: 150000, estimateApprovedAt: past},
    {destinationShopId: "shop-2"},
    {direction: "out", otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}},
    {ticketType: "WALK_IN"},
    {status: "6"},
  ];
  for (const state of cases) {
    const {renderer} = await render({ticket: ticket(state)});
    try {
      expect(actionLabels(renderer)).not.toContain(en.assist.sendEstimate);
    } finally {
      renderer.unmount();
    }
  }
});

test("expired estimates free the call to action and badge the card", async () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const {renderer} = await render({ticket: ticket({estimateAmount: 150000, estimateExpiresAt: past})});
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.estimateStateExpired);
    expect(actionLabels(renderer)).toContain(en.assist.sendEstimate);
  } finally {
    renderer.unmount();
  }
});

test("rider sees approve and decline on a live estimate", async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({direction: "out", otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, estimateAmount: 150000, estimateExpiresAt: future}),
    onApproveEstimate: () => undefined,
    onDeclineEstimate: () => undefined,
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.estimateStateAwaiting);
    const labels = actionLabels(renderer);
    expect(labels).toContain(en.assist.approve);
    expect(labels).toContain(en.assist.declineEstimate);
  } finally {
    renderer.unmount();
  }
});

test("rider handshake closes once the estimate is approved", async () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({direction: "out", otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, estimateAmount: 150000, estimateApprovedAt: past, estimateExpiresAt: past}),
    onApproveEstimate: () => undefined,
    onDeclineEstimate: () => undefined,
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.estimateStateApproved);
    expect(actionLabels(renderer)).not.toContain(en.assist.declineEstimate);
  } finally {
    renderer.unmount();
  }
});

test("quote-only rows keep the card without an estimate badge", async () => {
  const {renderer} = await render({ticket: ticket({direction: "out", otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, shopQuotedAmount: 120000})});
  try {
    const all = texts(renderer);
    expect(all).not.toContain(en.assist.estimateStateAwaiting);
    expect(actionLabels(renderer)).not.toContain(en.assist.declineEstimate);
  } finally {
    renderer.unmount();
  }
});

test("the record opens the journey bill", async () => {
  const onOpenBill = jest.fn();
  const {renderer} = await render({
    ticket: ticket({ticketType: "WALK_IN", status: "9", direction: "out", otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, shopQuotedAmount: 120000}),
    onApproveQuote: () => undefined,
    onOpenBill,
  });
  try {
    expect(texts(renderer)).toContain("120,000 VND");
    expect(actionLabels(renderer)).toContain(en.bills.openBill);
    expect(actionLabels(renderer)).not.toContain(en.assist.payNow);
    const open = tap(renderer, en.bills.openBill);
    await act(async () => {
      open?.props.onPress?.();
    });
    expect(onOpenBill).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("the bill link survives a payment on file", async () => {
  const {renderer} = await render({
    ticket: ticket({ticketType: "WALK_IN", status: "9", direction: "out", otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, shopQuotedAmount: 120000}),
    onApproveQuote: () => undefined,
    onOpenBill: jest.fn(),
    payment: {method: "SEPAY", status: "HELD"},
  });
  try {
    expect(actionLabels(renderer)).toContain(en.bills.openBill);
    expect(actionLabels(renderer)).not.toContain(en.assist.payNow);
  } finally {
    renderer.unmount();
  }
});

test("assigned tow does not see the destination shop's estimate", async () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({assignedShopId: "tow-1", estimateAmount: 150000, estimateApprovedAt: past, estimateExpiresAt: past}),
    ownTowId: "tow-1",
  });
  try {
    const all = texts(renderer);
    expect(all).not.toContain(en.assist.estimateTitle);
    expect(all).not.toContain("150,000 VND");
    expect(all).not.toContain(en.assist.estimateStateApproved);
  } finally {
    renderer.unmount();
  }
});

const towFare = {estimate: 150000, ceiling: 180000, deadheadKm: 2, loadedKm: 5, night: false};

test("the assigned tow opens the journey bill", async () => {
  const onOpenBill = jest.fn();
  const {renderer} = await render({
    ticket: ticket({ticketType: "TOW", status: "4", direction: "in", assignedShopId: "tow-1", towFare}),
    ownShopIds: new Set(),
    ownTowId: "tow-1",
    onOpenBill,
  });
  try {
    expect(actionLabels(renderer)).toContain(en.bills.openBill);
    const open = tap(renderer, en.bills.openBill);
    await act(async () => {
      open?.props.onPress?.();
    });
    expect(onOpenBill).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("the destination shop opens the journey bill", async () => {
  const onOpenBill = jest.fn();
  const {renderer} = await render({
    ticket: ticket({ticketType: "TOW", status: "4", direction: "in", assignedShopId: "tow-1", destinationShopId: "shop-1", towFare}),
    ownTowId: null,
    onOpenBill,
  });
  try {
    expect(actionLabels(renderer)).toContain(en.bills.openBill);
  } finally {
    renderer.unmount();
  }
});

test("a candidate and an unrelated viewer do not get the bill link", async () => {
  const candidate = await render({
    ticket: ticket({ticketType: "TOW", status: "1", direction: "in", assignedShopId: null, providerId: "shop-1", towFare}),
    onOpenBill: jest.fn(),
  });
  try {
    expect(actionLabels(candidate.renderer)).not.toContain(en.bills.openBill);
  } finally {
    candidate.renderer.unmount();
  }
  const other = await render({
    ticket: ticket({ticketType: "TOW", status: "2", direction: "in", assignedShopId: "tow-1", towFare}),
    ownShopIds: new Set(),
    onOpenBill: jest.fn(),
  });
  try {
    expect(actionLabels(other.renderer)).not.toContain(en.bills.openBill);
  } finally {
    other.renderer.unmount();
  }
});

test("cash confirmation appears only for the payment payee", async () => {
  const onConfirmCash = jest.fn();
  const hidden = await render({
    ticket: ticket({status: "2", paymentMethod: "CASH", paymentStatus: "PENDING", canConfirmCash: false}),
    onConfirmCash,
  });
  try {
    expect(actionLabels(hidden.renderer)).not.toContain(en.assist.cashConfirmReceipt);
  } finally {
    hidden.renderer.unmount();
  }
  const shown = await render({
    ticket: ticket({status: "2", paymentMethod: "CASH", paymentStatus: "PENDING", canConfirmCash: true}),
    onConfirmCash,
  });
  try {
    expect(actionLabels(shown.renderer)).toContain(en.assist.cashConfirmReceipt);
    const button = tap(shown.renderer, en.assist.cashConfirmReceipt);
    await act(async () => {
      button?.props.onPress?.();
    });
    expect(onConfirmCash).toHaveBeenCalledTimes(1);
  } finally {
    shown.renderer.unmount();
  }
});
