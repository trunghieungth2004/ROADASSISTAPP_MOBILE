import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {ScrollView} from "react-native";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RecordDetailSheet from "../../../../src/screens/assist/RecordDetailSheet";
import {usePhotoUrl} from "../../../../src/services/photos";
import {en} from "../../../../src/i18n/en";
import type {Bill} from "../../../../src/api/bills";
import type {FeedTicket} from "../../../../src/api/dispatch";

jest.mock("../../../../src/services/photos", () => ({
  usePhotoUrl: jest.fn(() => ""),
  resolvePhotoUrl: jest.fn(async () => ""),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof RecordDetailSheet>;

const mockedUsePhotoUrl = jest.mocked(usePhotoUrl);

function ticket(overrides?: Partial<FeedTicket>): FeedTicket {
  return {
    id: "t1",
    ticketType: "TOW",
    lat: 10.71,
    lng: 106.61,
    status: "2",
    direction: "out",
    otherParty: {name: "Rider", kind: "RIDER"},
    ...overrides,
  } as FeedTicket;
}

async function render(overrides?: Partial<Props>) {
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
  return renderer;
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

test("the assigned tower marks arrival and delivery", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const arrived = await render({
    ticket: ticket({
      ticketType: "TOW",
      direction: "in",
      status: "2",
      assignedShopId: "tow1",
      otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
    }),
    ownTowId: "tow1",
  });
  try {
    expect(texts(arrived)).toContain(en.assist.arrivedAtPickup);
  } finally {
    arrived.unmount();
  }
  const delivered = await render({
    ticket: ticket({
      ticketType: "TOW",
      towKind: "RETURN",
      direction: "in",
      status: "3",
      assignedShopId: "tow1",
      loadedAt: "2026-01-01T00:00:00.000Z",
      otherParty: {id: "rider1", name: "Rider", kind: "RIDER"},
    }),
    ownTowId: "tow1",
  });
  try {
    expect(texts(delivered)).toContain(en.assist.deliveredToRider);
  } finally {
    delivered.unmount();
  }
});

test("an unfixable walk-in still offers a return tow", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const onRespondReturnTow = jest.fn();
  const renderer = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      direction: "out",
      status: "15",
      returnTowOffer: {
        status: "PENDING",
        shopId: "shop-1",
        by: "u9",
        at: "2026-01-01T00:00:00.000Z",
      },
    }),
    onRespondReturnTow,
  });
  try {
    const action = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.returnTow && typeof n.props?.onPress === "function")
      .at(0);
    expect(action).toBeDefined();
    await act(async () => {
      await action?.props.onPress();
    });
    expect(onRespondReturnTow).toHaveBeenCalledWith(expect.objectContaining({id: "t1"}), true);
  } finally {
    renderer.unmount();
  }
});

test("an old unfixable walk-in offers a return tow without a stored offer", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const onRespondReturnTow = jest.fn();
  const renderer = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      direction: "out",
      status: "15",
      returnTowOffer: null,
    }),
    onRespondReturnTow,
  });
  try {
    const action = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.returnTow && typeof n.props?.onPress === "function")
      .at(0);
    expect(action).toBeDefined();
    await act(async () => {
      await action?.props.onPress();
    });
    expect(onRespondReturnTow).toHaveBeenCalledWith(expect.objectContaining({id: "t1"}), true);
  } finally {
    renderer.unmount();
  }
});

test("the rider confirms receipt after delivery", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const onConfirmTowReceived = jest.fn();
  const renderer = await render({
    ticket: ticket({
      ticketType: "TOW",
      direction: "out",
      status: "4",
      deliveredAt: "2026-01-01T00:00:00.000Z",
      receivedAt: null,
    }),
    onConfirmTowReceived,
  });
  try {
    const confirm = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.confirmReceived && typeof n.props?.onPress === "function")
      .at(0);
    expect(confirm).toBeDefined();
    await act(async () => {
      await confirm?.props.onPress();
    });
    expect(onConfirmTowReceived).toHaveBeenCalledWith(expect.objectContaining({id: "t1"}));
  } finally {
    renderer.unmount();
  }
});

test("shop phone number renders with a call icon", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const renderer = await render({
    ticket: ticket({
      ticketType: "WALK_IN",
      direction: "out",
      otherParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", label: "12 Le Loi", openNow: true, phone: "+84111"},
    }),
  });
  try {
    expect(texts(renderer)).toContain("+84111");
    expect(renderer.root.findAll((n) => n.props?.name === "call").length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("tow journey pairs stretch-equal pickup and drop-off columns", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const renderer = await render({
    ticket: ticket({
      direction: "out",
      status: "1",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"},
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
      destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true},
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.pickup);
    expect(all).toContain(en.assist.dropOffPoint);
    expect(all.indexOf("12 Le Loi")).toBeGreaterThanOrEqual(0);
    expect(all.indexOf("12 Le Loi")).toBeLessThan(all.indexOf("Fix Shop"));
    const row = renderer.root.findAll((n) => {
      const flat = flatStyle(n.props?.style);
      return flat.flexDirection === "row" && flat.alignItems === "stretch";
    });
    expect(row.length).toBeGreaterThan(0);
    const columns = renderer.root.findAll((n) => flatStyle(n.props?.style).flex === 1);
    expect(columns.length).toBeGreaterThanOrEqual(2);
  } finally {
    renderer.unmount();
  }
});

test("note, description, work type and photos share one card", async () => {
  mockedUsePhotoUrl.mockImplementation((path) => path?.endsWith("one.jpg") ? "file://r1.jpg" : "");
  const renderer = await render({
    ticket: ticket({
      note: "Bike will not start",
      description: "Dead battery, near the market",
      workType: "Battery swap",
      photoUrls: ["gs://ticket/one.jpg"],
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.notesPhotos);
    expect(all).toContain("Bike will not start");
    expect(all).toContain("Dead battery, near the market");
    expect(all).toContain(`${en.provider.workType}: Battery swap`);
    expect(all).toContain(en.assist.photos);
    expect(renderer.root.findAll((n) => n.props?.source?.uri === "file://r1.jpg").length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("mobile shop pickup uses the mobile shop icon", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const renderer = await render({
    ticket: ticket({
      ticketType: "SOS",
      direction: "out",
      otherParty: {id: "mobile-1", name: "Mobile One", kind: "MOBILE_SHOP", openNow: true},
    }),
    ownMobileShopId: "mobile-1",
  });
  try {
    expect(texts(renderer)).toContain("Mobile One");
    expect(renderer.root.findAll((n) => n.props?.name === "build").length).toBeGreaterThan(0);
    expect(renderer.root.findAll((n) => n.props?.name === "storefront").length).toBe(0);
  } finally {
    renderer.unmount();
  }
});

test("tow pickup keeps the tower card without the role title", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const renderer = await render({
    ticket: ticket({
      direction: "out",
      otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW", ratingAvg: 5, ratingCount: 3, phone: "+84999"},
      destinationShopId: "shop-1",
      destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
    }),
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.pickup);
    expect(all).toContain("Tow Seven");
    expect(all).toContain("+84999");
    expect(renderer.root.findAll((n) => n.props?.name === "star").length).toBeGreaterThan(0);
    expect(all).not.toContain(en.roles.tow);
  } finally {
    renderer.unmount();
  }
});

function historyTexts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string" &&
      (n.props.accessibilityLabel as string).includes(en.assist.statusResolved))
    .flatMap((n) => n.findAll((c) => typeof c.props?.children === "string").map((c) => c.props.children as string));
}

test("destination ETA sits in the header pill", async () => {
  const eta = new Date(Date.now() + 10 * 60 * 1000 + 500).toISOString();
  const renderer = await render({ticket: ticket({etaDropoffAt: eta})});
  try {
    expect(texts(renderer)).toContain(en.shop.etaDropoffPill.replace("{n}", "10"));
  } finally {
    renderer.unmount();
  }
});

test("archived chat appears in conversation history", async () => {
  const onOpenArchivedChat = jest.fn();
  const renderer = await render({
    ticket: ticket({chatHistory: [{
      version: 0,
      roomId: "ticket_t1",
      shopId: "tow1",
      shopName: "Tow Co",
      at: "2026-01-01T00:00:00.000Z",
    }]}),
    onOpenArchivedChat,
  });
  try {
    expect(texts(renderer)).toContain(en.chat.previousChats);
    expect(texts(renderer)).toContain(`${en.chat.previousChat} · Tow Co`);
    const row = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.chat.previousChat &&
        typeof n.props?.onPress === "function")[0];
    await act(async () => {
      await row?.props.onPress();
    });
    expect(onOpenArchivedChat).toHaveBeenCalledWith(
      expect.objectContaining({id: "t1"}),
      0,
    );
  } finally {
    renderer.unmount();
  }
});

test("status history sits in its own status card", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const at = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const renderer = await render({ticket: ticket({status: "4", note: "Battery replaced", statusHistory: [
    {status: "1", at, by: "u1"},
    {status: "2", at, by: "u1"},
    {status: "4", at, by: "u1"},
  ]})});
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.notesPhotos);
    expect(all).toContain("Battery replaced");
    expect(all).toContain(en.assist.statusTitle);
    expect(all.filter((text) => text === en.assist.statusResolved).length).toBeGreaterThanOrEqual(2);
    expect(historyTexts(renderer)).toContain(en.assist.statusResolved);
  } finally {
    renderer.unmount();
  }
});

test("status card renders when the ticket has no content", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const renderer = await render({ticket: ticket({status: "4"})});
  try {
    expect(texts(renderer)).toContain(en.assist.notesPhotos);
    expect(texts(renderer)).toContain(en.assist.statusTitle);
    expect(historyTexts(renderer)).toContain(en.assist.statusResolved);
  } finally {
    renderer.unmount();
  }
});

test("bill totals and item fees share one payment card", async () => {
  mockedUsePhotoUrl.mockImplementation(() => "");
  const bill: Bill = {
    billId: "t1",
    ticketId: "t1",
    ticketType: "TOW",
    ticketStatus: "4",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "VND",
    total: 150000,
    paid: 50000,
    due: 100000,
    status: "PARTIAL",
    viewer: "RIDER",
    canPay: true,
    items: [],
  };
  const renderer = await render({
    ticket: ticket({
      status: "4",
      towFare: {estimate: 150000, ceiling: 150000, deadheadKm: 1, loadedKm: 2, night: false},
    }),
    bill,
  });
  try {
    const all = texts(renderer);
    expect(all).toContain(en.assist.paymentTitle);
    expect(all).toContain(en.bills.statusPartial);
    expect(all).toContain("150,000 VND");
    expect(all).toContain("50,000 VND");
    expect(all).toContain("100,000 VND");
    expect(all).toContain(`${en.assist.fareUpTo}: 150,000 VND`);
  } finally {
    renderer.unmount();
  }
});

test("previous SOS is a compact link that opens a read-only summary", async () => {
  mockedUsePhotoUrl.mockImplementation((path) =>
    path?.endsWith("evidence.jpg") ? "file://evidence.jpg" : "");
  const renderer = await render({
    ticket: ticket({
      ticketType: "SOS",
      status: "1",
      linkedSummary: {
        ticketId: "old-sos",
        ticketType: "SOS",
        evidencePhotoUrls: ["dispatch/old/evidence.jpg"],
        unfixableReason: "SAFETY",
        sosAttempt: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    }),
  });
  try {
    expect(texts(renderer)).toContain(en.assist.previousSos);
    expect(texts(renderer)).toContain(
      en.assist.sosAttempt.replace("{n}", "1"),
    );
    expect(texts(renderer)).toContain(en.assist.unfixableSafety);
    const row = renderer.root
      .findAll((n) => typeof n.props?.accessibilityLabel === "string" &&
        (n.props.accessibilityLabel as string).includes(en.assist.previousSos))
      .find((n) => typeof n.props?.onPress === "function");
    expect(row).toBeDefined();
    const scrollsBefore = renderer.root.findAllByType(ScrollView)
      .filter((node) => node.props.horizontal !== true).length;
    await act(async () => {
      await row?.props.onPress();
    });
    const scrollsAfter = renderer.root.findAllByType(ScrollView)
      .filter((node) => node.props.horizontal !== true).length;
    expect(scrollsAfter).toBe(scrollsBefore);
    expect(texts(renderer)).toContain(en.assist.previousShopEvidence);
    expect(renderer.root.findAll((n) => n.props?.source?.uri === "file://evidence.jpg").length).toBeGreaterThan(0);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("the detail body scrolls so the footer stays reachable", async () => {
  const renderer = await render();
  try {
    const vertical = renderer.root.findAllByType(ScrollView)
      .filter((node) => node.props.horizontal !== true);
    expect(vertical.length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("a revised invoice asks the rider to approve it", async () => {
  const onApproveInvoice = jest.fn();
  const renderer = await render({
    ticket: ticket({invoiceApproval: "PENDING", invoiceAmount: 180000, shopQuotedAmount: 150000}),
    onApproveInvoice,
  });
  try {
    expect(texts(renderer)).toContain(en.assist.invoicePending);
    const action = renderer.root.findAll((n) =>
      n.props?.accessibilityLabel === en.assist.approveInvoice &&
      typeof n.props?.onPress === "function")[0];
    expect(action).toBeDefined();
    await act(async () => {
      await action?.props.onPress();
    });
    expect(onApproveInvoice).toHaveBeenCalledWith(expect.objectContaining({id: "t1"}));
  } finally {
    renderer.unmount();
  }
});

test("a mobile fix approval lives in the payment card", async () => {
  const onApproveMobileFix = jest.fn();
  const onDeclineMobileFix = jest.fn();
  const renderer = await render({
    ticket: ticket({
      ticketType: "SOS",
      direction: "out",
      status: "9",
      assignedShopId: "mobile-1",
      finalAmount: 120000,
    }),
    onApproveMobileFix,
    onDeclineMobileFix,
  });
  try {
    const approve = renderer.root.findAll((n) =>
      n.props?.testID === "fees-quote-approve")[0];
    const decline = renderer.root.findAll((n) =>
      n.props?.testID === "fees-quote-decline")[0];
    const approveSlot = renderer.root.findAll((n) =>
      n.props?.testID === "fees-quote-approve-slot")[0];
    const declineSlot = renderer.root.findAll((n) =>
      n.props?.testID === "fees-quote-decline-slot")[0];
    expect(approve).toBeDefined();
    expect(decline).toBeDefined();
    expect(flatStyle(approveSlot?.props.style).flex).toBe(1);
    expect(flatStyle(declineSlot?.props.style).flex).toBe(1);
    await act(async () => {
      await approve?.props.onPress();
    });
    expect(onApproveMobileFix).toHaveBeenCalledWith(expect.objectContaining({id: "t1"}));
  } finally {
    renderer.unmount();
  }
});

test("prior mobile and tower partials stay visible in the money block", async () => {
  const mobile = await render({
    ticket: ticket({
      ticketType: "SOS",
      direction: "out",
      status: "4",
      assignedShopId: "mobile-1",
      finalAmount: 120000,
      mobileFeeHistory: [{shopId: "mobile-0", callOutFee: 30000, travelFee: 5000, waived: false, declinedAt: "2026-01-01T00:00:00.000Z"}],
    }),
  });
  try {
    expect(texts(mobile)).toContain(en.assist.priorMobileFees);
  } finally {
    mobile.unmount();
  }
  const tow = await render({
    ticket: ticket({
      ticketType: "TOW",
      direction: "out",
      status: "4",
      towFare: {estimate: 300000, ceiling: 330000, final: 200000, deadheadKm: 0, loadedKm: 0, night: false},
      towFeeHistory: [{shopId: "tow-0", amount: 50000, deadheadKm: 2, loadedKm: 1, at: "2026-01-01T00:00:00.000Z"}],
    }),
  });
  try {
    expect(texts(tow)).toContain(en.assist.priorTowPartial);
  } finally {
    tow.unmount();
  }
});

test("a declined mobile fix uses mobile wording, not tower wording", async () => {
  const renderer = await render({
    ticket: ticket({
      ticketType: "SOS",
      direction: "in",
      status: "1",
      formerAssignment: true,
      formerAssignmentKind: "MOBILE_SHOP",
      mobileFeeHistory: [{
        shopId: "mobile-1",
        callOutFee: 50000,
        travelFee: 10000,
        waived: false,
        declinedAt: "2026-01-01T00:00:00.000Z",
        reason: "PRICE_TOO_HIGH",
      }],
    }),
  });
  try {
    const all = texts(renderer);
    expect(all.some((text) =>
      text.startsWith(en.assist.formerFixDeclinedBanner))).toBe(true);
    expect(all.some((text) =>
      text.includes(en.assist.quoteDeclinePrice))).toBe(true);
    expect(all.join(" ")).not.toContain(en.assist.formerAssignmentBanner);
  } finally {
    renderer.unmount();
  }
});
