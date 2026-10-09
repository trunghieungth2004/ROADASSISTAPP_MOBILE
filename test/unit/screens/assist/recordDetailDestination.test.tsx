import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RecordDetailSheet from "../../../../src/screens/assist/RecordDetailSheet";
import {en} from "../../../../src/i18n/en";
import {clearGeocodeCache, formatPoint} from "../../../../src/api/places";
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
    otherParty: {name: "Rider", kind: "RIDER"},
    ...overrides,
  } as FeedTicket;
}

async function render(overrides?: Partial<Props>) {
  const onDeclineDestination = jest.fn();
  const onOpenShop = jest.fn();
  const onOpenDestination = jest.fn();
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
          onOpenShop={onOpenShop}
          onOpenDestination={onOpenDestination}
          onNavigateJob={null}
          acceptDisabled={false}
          towPreview={null}
          onPreviewTowRoute={null}
          linked={null}
          onOpenLinked={() => undefined}
          onAdvance={() => undefined}
          onReply={() => undefined}
          onRateRider={() => undefined}
          ownShopIds={new Set(["shop-1"])}
          onDeclineDestination={onDeclineDestination}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onDeclineDestination, onOpenShop, onOpenDestination};
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

test("registered destination shows the shop name and decline action", async () => {
  const {renderer, onDeclineDestination} = await render({
    ticket: ticket({
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
    }),
  });
  try {
    expect(texts(renderer)).toContain("Fix Shop");
    expect(actionLabels(renderer)).toContain(en.assist.declineDestination);
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.declineDestination)[0];
    await act(async () => {
      await btn?.props.onPress?.();
    });
    expect(onDeclineDestination).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("free-point destination shows its label without the decline action", async () => {
  const {renderer} = await render({
    ticket: ticket({
      destinationShopId: null,
      destinationSnapshot: {lat: 10.76, lng: 106.66, label: "My garage", source: "point"},
    }),
  });
  try {
    expect(texts(renderer)).toContain("My garage");
    expect(actionLabels(renderer)).not.toContain(en.assist.declineDestination);
  } finally {
    renderer.unmount();
  }
});

test("another shop's destination is read-only", async () => {
  const {renderer} = await render({
    ticket: ticket({
      destinationShopId: "shop-2",
      destinationSnapshot: {id: "shop-2", name: "Other Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
    }),
  });
  try {
    expect(texts(renderer)).toContain("Other Shop");
    expect(actionLabels(renderer)).not.toContain(en.assist.declineDestination);
  } finally {
    renderer.unmount();
  }
});

test("no destination renders no drop-off block", async () => {
  const {renderer} = await render({ticket: ticket()});
  try {
    expect(texts(renderer)).not.toContain(en.assist.dropOffPoint);
  } finally {
    renderer.unmount();
  }
});

test("tow names the tower as a tower with labeled pickup and drop-off", async () => {
  const {renderer} = await render({
    ticket: ticket({
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW", label: "Depot 7"},
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain("Tow Seven");
    expect(all).toContain(en.roles.tow);
    expect(all).toContain(en.assist.pickup);
    expect(all).toContain(en.assist.dropOffPoint);
    expect(all).toContain("Fix Shop");
    expect(all).not.toContain("Depot 7");
  } finally {
    renderer.unmount();
  }
});

test("shop block leads with the name above address, stars, phone and status", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      direction: "out",
      otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", label: "12 Le Loi", openNow: true, ratingAvg: 4.5, ratingCount: 12, phone: "+84111"},
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.roles.shop);
    const names = all.map((text, i) => ({text, i})).filter((row) => row.text === "Fix Shop").map((row) => row.i);
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names[0]).toBeLessThan(all.indexOf("12 Le Loi"));
    expect(all.indexOf("12 Le Loi")).toBeLessThan(all.indexOf("+84111"));
  } finally {
    renderer.unmount();
  }
});

test("non-tow tickets show no pickup label", async () => {
  const {renderer} = await render({
    ticket: ticket({ticketType: "SOS", direction: "out", otherParty: null}),
  });
  try {
    expect(texts(renderer)).not.toContain(en.assist.pickup);
  } finally {
    renderer.unmount();
  }
});

test("pending tow shows the destination shop only once", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
      destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain("Fix Shop");
    expect(all).toContain(en.assist.dropOffPoint);
    expect(all.filter((text) => text === "Fix Shop").length).toBe(6);
    expect(all.filter((text) => text === "12 Le Loi").length).toBe(3);
  } finally {
    renderer.unmount();
  }
});

test("tapping the shop card opens the shop modal", async () => {
  const {renderer, onOpenShop} = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      direction: "out",
      otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
    }),
  });
  try {
    const card = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "Fix Shop" && typeof n.props?.onPress === "function")
      .pop();
    expect(card).toBeDefined();
    await act(async () => {
      await card?.props.onPress();
    });
    expect(onOpenShop).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("tapping the drop-off shop card opens the destination modal", async () => {
  const {renderer, onOpenDestination} = await render({
    ticket: ticket({
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
      destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
    }),
  });
  try {
    const card = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "Fix Shop" && typeof n.props?.onPress === "function")
      .pop();
    expect(card).toBeDefined();
    await act(async () => {
      await card?.props.onPress();
    });
    expect(onOpenDestination).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("place container falls back to coordinates without a geocode hit", async () => {
  await clearGeocodeCache();
  const {renderer} = await render({
    ticket: ticket({ticketType: "TOW", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}}),
  });
  try {
    expect(texts(renderer)).toContain(en.assist.pickup);
    expect(texts(renderer)).toContain(formatPoint(10.71, 106.61));
  } finally {
    renderer.unmount();
  }
});