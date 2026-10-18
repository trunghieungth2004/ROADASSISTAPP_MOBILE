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
    direction: "out",
    otherParty: {name: "Tow Seven", kind: "TOW"},
    ...overrides,
  } as FeedTicket;
}

async function render(overrides?: Partial<Props>) {
  const onOpenDispute = jest.fn();
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
          gps={null}
          uid="u1"
          hasRated={false}
          onClose={() => undefined}
          onConfirmCancel={() => undefined}
          onRate={() => undefined}
          onAccept={() => undefined}
          onDecline={() => undefined}
          onSaveWork={() => undefined}
          onSendQuote={() => undefined}
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
          showRequestPhotos
          onDeclineDestination={() => undefined}
          onEditDestination={null}
          allowTowerCancel={false}
          onOpenDispute={onOpenDispute}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onOpenDispute};
}

function disputeCount(renderer: ReturnType<typeof create>): number {
  return renderer.root
    .findAll((n) => n.props?.accessibilityLabel === en.assist.disputeTicket && typeof n.props?.onPress === "function")
    .length;
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

test("pending tow with no tower hides the whole dispute surface", async () => {
  const {renderer} = await render({ticket: ticket({status: "1", otherParty: null})});
  try {
    expect(disputeCount(renderer)).toBe(0);
  } finally {
    renderer.unmount();
  }
});

test("terminal tickets keep the dispute surface closed", async () => {
  for (const status of ["5", "8"]) {
    const {renderer} = await render({ticket: ticket({status, cancelledBy: "rider1"})});
    try {
      expect(disputeCount(renderer)).toBe(0);
    } finally {
      renderer.unmount();
    }
  }
});

test("matched tow offers exactly one dispute entry", async () => {
  const {renderer} = await render();
  try {
    expect(disputeCount(renderer)).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("tower cancel banner carries the only dispute entry while requeued", async () => {
  const {renderer} = await render({ticket: ticket({status: "1", cancelledBy: "op1"})});
  try {
    expect(texts(renderer)).toContain(en.assist.towerCancelMid);
    expect(disputeCount(renderer)).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("a re-matched tow drops the banner and keeps the footer chip", async () => {
  const {renderer} = await render({ticket: ticket({status: "2", cancelledBy: null})});
  try {
    expect(texts(renderer)).not.toContain(en.assist.towerCancelMid);
    expect(disputeCount(renderer)).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("shop decline banner supersedes the footer chip", async () => {
  const {renderer} = await render({ticket: ticket({status: "2", towLegs: [{toShopId: "shop-9"}]})});
  try {
    expect(texts(renderer)).toContain(en.assist.shopDeclineMid);
    expect(disputeCount(renderer)).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("resolved tow with a fare keeps a dispute entry inside the week", async () => {
  const towFare = {estimate: 200000, ceiling: 300000, deadheadKm: 2, loadedKm: 5, night: false};
  const within = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({status: "4", towFare, statusHistory: [{status: "4", at: within, by: "u1"}]}),
  });
  try {
    expect(disputeCount(renderer)).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("stale or unfared resolved tickets drop the dispute entry", async () => {
  const towFare = {estimate: 200000, ceiling: 300000, deadheadKm: 2, loadedKm: 5, night: false};
  const stale = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({status: "4", towFare, statusHistory: [{status: "4", at: stale, by: "u1"}]}),
  });
  try {
    expect(disputeCount(renderer)).toBe(0);
  } finally {
    renderer.unmount();
  }
  const {renderer: free} = await render({ticket: ticket({status: "4"})});
  try {
    expect(disputeCount(free)).toBe(0);
  } finally {
    free.unmount();
  }
});

test("final quote card stays the only dispute entry", async () => {
  const {renderer} = await render({ticket: ticket({status: "11", finalAmount: 500000})});
  try {
    expect(disputeCount(renderer)).toBe(1);
  } finally {
    renderer.unmount();
  }
});

test("dispute chip fires the handler", async () => {
  const {renderer, onOpenDispute} = await render();
  try {
    const chip = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.disputeTicket && typeof n.props?.onPress === "function")
      .pop();
    await act(async () => {
      await chip?.props.onPress?.();
    });
    expect(onOpenDispute).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});
