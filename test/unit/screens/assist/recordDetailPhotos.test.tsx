import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RecordDetailSheet from "../../../../src/screens/assist/RecordDetailSheet";
import {usePhotoUrls} from "../../../../src/services/photos";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";
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
    direction: "in",
    otherParty: {name: "Rider", kind: "RIDER"},
    photoUrls: ["dispatch/a/1.jpg", "dispatch/a/2.jpg"],
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

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

function texts(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

function placeholders(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll((n) => {
    if (n.props?.source !== undefined || n.props?.style === undefined) return false;
    const flat = flatStyle(n.props.style);
    return flat.width === 64 && flat.height === 64 && flat.backgroundColor === lightTheme.border;
  });
}

test("stays hidden without permission and skips downloads", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
  const renderer = await render({showRequestPhotos: false});
  try {
    expect(texts(renderer)).not.toContain(en.assist.photos);
    expect(mockedUsePhotoUrls).toHaveBeenCalledWith(null);
    expect(placeholders(renderer)).toHaveLength(0);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("shows placeholder tiles while ticket photos resolve", async () => {
  mockedUsePhotoUrls.mockImplementation(() => []);
  const renderer = await render();
  try {
    expect(texts(renderer)).toContain(en.assist.photos);
    expect(renderer.root.findAll((n) => typeof n.props?.source?.uri === "string")).toHaveLength(0);
    expect(placeholders(renderer).length).toBeGreaterThanOrEqual(2);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});

test("renders resolved ticket photos", async () => {
  mockedUsePhotoUrls.mockImplementation((paths) => (Array.isArray(paths) && paths.length > 0 ? ["file://r1.jpg", "file://r2.jpg"] : []));
  const renderer = await render();
  try {
    expect(renderer.root.findAll((n) => n.props?.source?.uri === "file://r1.jpg").length).toBeGreaterThan(0);
    expect(renderer.root.findAll((n) => n.props?.source?.uri === "file://r2.jpg").length).toBeGreaterThan(0);
    expect(placeholders(renderer)).toHaveLength(0);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});
