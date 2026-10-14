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
          acceptHidden={false}
          towPreview={null}
          onPreviewTowRoute={null}
          linked={null}
          onOpenLinked={() => undefined}
          onAdvance={() => undefined}
          onReply={() => undefined}
          onRateRider={() => undefined}
          ownShopIds={new Set(["shop-1"])}
          onDeclineDestination={onDeclineDestination}
          onEditDestination={null}
          allowTowerCancel={false}
          acceptOffDuty={false}
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

test("non-tow tickets render no drop-off block without a destination", async () => {
  const {renderer} = await render({ticket: ticket({ticketType: "SOS", direction: "out", otherParty: null})});
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

test("sos tickets label the pickup like tow tickets", async () => {
  const {renderer} = await render({
    ticket: ticket({ticketType: "SOS", direction: "out", otherParty: null}),
  });
  try {
    expect(texts(renderer)).toContain(en.assist.pickup);
  } finally {
    renderer.unmount();
  }
});

test("pending tow with unassigned counterparty shows a boxed shop drop-off", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: null,
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
      destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.unassigned);
    expect(all).toContain("Fix Shop");
    expect(all).toContain(en.assist.dropOffPoint);
    expect(all).toContain("12 Le Loi");
    expect(all.filter((text) => text === "Fix Shop").length).toBe(3);
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

test("tow rows never offer the walk-in decline", async () => {
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

test("pending tow with an owned destination offers decline drop-off", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: null,
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
      destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
    }),
  });
  try {
    expect(actionLabels(renderer)).toContain(en.assist.declineDestination);
    expect(texts(renderer)).not.toContain("Can't take this vehicle");
  } finally {
    renderer.unmount();
  }
});

test("place container falls back to coordinates without a geocode hit", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "in",
      otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
    }),
  });
  try {
    expect(actionLabels(renderer)).not.toContain(en.provider.decline);
  } finally {
    renderer.unmount();
  }
});

test("pending walk-in rows keep the walk-in decline", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      status: "1",
      direction: "in",
      otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
    }),
  });
  try {
    expect(actionLabels(renderer)).toContain(en.provider.decline);
  } finally {
    renderer.unmount();
  }
});

test("stale preview summary never leaks past matched", async () => {
  const preview = {ready: true, summary: "9.9 km · 99 min", busy: false, error: null};
  const {renderer: resolved} = await render({
    ticket: ticket({ticketType: "TOW", status: "4", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}}),
    towPreview: preview,
  });
  try {
    expect(texts(resolved)).not.toContain("9.9 km · 99 min");
  } finally {
    resolved.unmount();
  }
  const {renderer: matched} = await render({
    ticket: ticket({ticketType: "TOW", status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}}),
    towPreview: preview,
  });
  try {
    expect(texts(matched)).toContain("9.9 km · 99 min");
  } finally {
    matched.unmount();
  }
});

test("hidden accept keeps the flow hint without the action", async () => {
  const {renderer: hidden} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "in",
      otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
    }),
    acceptHidden: true,
  });
  try {
    expect(actionLabels(hidden)).not.toContain(en.assist.accept);
    expect(texts(hidden)).toContain(en.assist.towAcceptHint);
  } finally {
    hidden.unmount();
  }
  const {renderer: shown} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "in",
      otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
    }),
    acceptHidden: false,
  });
  try {
    expect(actionLabels(shown)).toContain(en.assist.accept);
  } finally {
    shown.unmount();
  }
});
test("destination-less tow shows an empty drop-off block", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: null,
      destinationShopId: null,
      destinationSnapshot: null,
      destinationPoint: null,
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.dropOffPoint);
    expect(all).toContain(en.assist.noDropOff);
  } finally {
    renderer.unmount();
  }
});

test("rider tow offers change drop-off, walk-ins do not", async () => {
  const onEditDestination = jest.fn();
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: null,
    }),
    onEditDestination,
  });
  try {
    expect(actionLabels(renderer)).toContain(en.assist.changeDropOff);
    const btn = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.changeDropOff)[0];
    await act(async () => {
      await btn?.props.onPress?.();
    });
    expect(onEditDestination).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
  const {renderer: walkin} = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      status: "1",
      direction: "out",
      otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", label: "12 Le Loi", openNow: true},
    }),
    onEditDestination,
  });
  try {
    expect(actionLabels(walkin)).not.toContain(en.assist.changeDropOff);
    expect(texts(walkin)).not.toContain(en.assist.noDropOff);
  } finally {
    walkin.unmount();
  }
});

test("empty drop-off block carries its own add button", async () => {
  const onEditDestination = jest.fn();
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: null,
      destinationShopId: null,
      destinationSnapshot: null,
      destinationPoint: null,
    }),
    onEditDestination,
  });
  try {
    const block = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.changeDropOff && typeof n.props?.onPress === "function");
    expect(block.length).toBe(2);
    const inline = block[block.length - 1];
    await act(async () => {
      await inline?.props.onPress?.();
    });
    expect(onEditDestination).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("tow ETA pill prefixes the live tower distance", async () => {
  const future = new Date(Date.now() + 12 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
      etaPickupAt: future,
      towerFix: {lat: 10.7109, lng: 106.6109, at: future},
    }),
  });
  try {
    const pill = texts(renderer).filter((text) => text.includes(en.shop.etaPickup.replace("{n}", "12")));
    expect(pill.length).toBeGreaterThan(0);
    expect(pill.every((text) => text.includes(" m "))).toBe(true);
  } finally {
    renderer.unmount();
  }
});

test("inbound tow sees the same ETA pill as the rider", async () => {
  const future = new Date(Date.now() + 12 * 60 * 1000).toISOString();
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "in",
      otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"},
      etaPickupAt: future,
      towerFix: {lat: 10.7109, lng: 106.6109, at: future},
    }),
  });
  try {
    const pill = texts(renderer).filter((text) => text.includes(en.shop.etaPickup.replace("{n}", "12")));
    expect(pill.length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("outbound tow shows a helper card with call action", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW", phone: "0901234567", ratingAvg: 5, ratingCount: 3},
    }),
  });
  try {
    expect(texts(renderer)).toContain("0901234567");
    expect(texts(renderer)).toContain(en.roles.tow);
  } finally {
    renderer.unmount();
  }
});

test("inbound empty drop-off stays neutral without a pick nudge", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "in",
      otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"},
      destinationShopId: null,
    }),
  });
  try {
    expect(texts(renderer)).toContain(en.assist.noDropOffAssigned);
    expect(texts(renderer)).not.toContain(en.assist.noDropOff);
  } finally {
    renderer.unmount();
  }
});

test("live tow with a route shows the summary in the sheet", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
    }),
    towPreview: {ready: true, summary: "1.5 km · 10 min", busy: false, error: null},
  });
  try {
    expect(texts(renderer)).toContain("1.5 km · 10 min");
  } finally {
    renderer.unmount();
  }
});

test("engaged tower sees cancel with confirm on a live tow", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "in",
      assignedShopId: "tow1",
      otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"},
    }),
    allowTowerCancel: true,
  });
  try {
    expect(actionLabels(renderer)).toContain(en.assist.cancel);
    expect(actionLabels(renderer)).not.toContain(en.assist.confirmCancel);
    const cancel = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.cancel && typeof n.props?.onPress === "function")
      .at(0);
    await act(async () => {
      await cancel?.props.onPress();
    });
    expect(actionLabels(renderer)).toContain(en.assist.confirmCancel);
    expect(actionLabels(renderer)).toContain(en.assist.keepRequest);
  } finally {
    renderer.unmount();
  }
});

test("tower without engagement sees no cancel", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "in",
      assignedShopId: "tow1",
      otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"},
    }),
  });
  try {
    expect(actionLabels(renderer)).not.toContain(en.assist.cancel);
  } finally {
    renderer.unmount();
  }
});

test("board preview shows the fare estimate beside the summary", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "1",
      direction: "out",
      otherParty: null,
      destinationShopId: "shop-1",
      destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65},
    }),
    towPreview: {ready: true, summary: "1.5 km", fareEstimate: 200000, busy: false, error: null},
  });
  try {
    expect(texts(renderer)).toContain(`${en.assist.fareEstimate}: 200,000 VND`);
  } finally {
    renderer.unmount();
  }
});

test("matched tow shows the ceiling as up-to", async () => {
  const {renderer} = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "2",
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
      towFare: {estimate: 200000, ceiling: 220000, final: null, deadheadKm: 2, loadedKm: 8, night: false, vehicleClass: "SOLO_BIKE"},
    }),
  });
  try {
    expect(texts(renderer)).toContain(`${en.assist.fareUpTo}: 220,000 VND`);
  } finally {
    renderer.unmount();
  }
});

test("resolved tow shows the final and cancelled shows the partial", async () => {
  const settled = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "4",
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
      towFare: {estimate: 200000, ceiling: 220000, final: 200000, deadheadKm: 2, loadedKm: 8, night: false, vehicleClass: "SOLO_BIKE"},
    }),
  });
  try {
    expect(texts(settled.renderer)).toContain(`${en.assist.fareFinal}: 200,000 VND`);
  } finally {
    settled.renderer.unmount();
  }
  const cancelled = await render({
    ticket: ticket({
      ticketType: "TOW",
      status: "5",
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
      towFare: {estimate: 0, ceiling: 0, final: 20000, partial: true, deadheadKm: 2, loadedKm: 0, night: false, vehicleClass: "SOLO_BIKE"},
    }),
  });
  try {
    expect(texts(cancelled.renderer)).toContain(`${en.assist.farePartial}: 20,000 VND`);
  } finally {
    cancelled.renderer.unmount();
  }
});
