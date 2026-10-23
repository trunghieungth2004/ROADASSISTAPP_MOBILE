import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RecordDetailSheet from "../../../../src/screens/assist/RecordDetailSheet";
import {usePhotoUrls} from "../../../../src/services/photos";
import {en} from "../../../../src/i18n/en";
import type {Bill} from "../../../../src/api/bills";
import type {FeedTicket} from "../../../../src/api/dispatch";

jest.mock("../../../../src/services/photos", () => ({
  usePhotoUrls: jest.fn(() => [] as string[]),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type Props = React.ComponentProps<typeof RecordDetailSheet>;

const mockedUsePhotoUrls = jest.mocked(usePhotoUrls);

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

test("shop phone number renders with a call icon", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
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
  mockedUsePhotoUrls.mockImplementation(() => []);
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
  mockedUsePhotoUrls.mockImplementation((paths) => (Array.isArray(paths) && paths.length > 0 ? ["file://r1.jpg"] : []));
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

test("tow pickup keeps the tower card without the role title", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
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
    .findAll((n) => flatStyle(n.props?.style).marginLeft === "auto")
    .flatMap((n) => n.findAll((c) => typeof c.props?.children === "string").map((c) => c.props.children as string));
}

test("status history sits in the notes and photos header row", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
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
    expect(all.filter((text) => text === en.assist.statusResolved).length).toBeGreaterThanOrEqual(2);
    expect(historyTexts(renderer)).toContain(en.assist.statusResolved);
  } finally {
    renderer.unmount();
  }
});

test("notes and photos header keeps the status history when the ticket has no content", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
  const renderer = await render({ticket: ticket({status: "4"})});
  try {
    expect(texts(renderer)).toContain(en.assist.notesPhotos);
    expect(historyTexts(renderer)).toContain(en.assist.statusResolved);
  } finally {
    renderer.unmount();
  }
});

test("bill totals and item fees share one payment card", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
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
