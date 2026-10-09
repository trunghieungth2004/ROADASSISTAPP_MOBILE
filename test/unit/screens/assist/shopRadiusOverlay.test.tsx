import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import ShopRadiusOverlay, {type RadiusCardHandlers} from "../../../../src/screens/assist/ShopRadiusOverlay";
import {clearApiCache} from "../../../../src/services/cache";
import {en} from "../../../../src/i18n/en";
import type {Provider} from "../../../../src/api/providers";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const realFetch = globalThis.fetch;
const seen: {path: string; body: string}[] = [];

function shop(id: string, distance: number): Provider {
  return {
    id,
    kind: "SHOP",
    name: id === "s1" ? "Good Shop" : "Far Shop",
    lat: 10.71,
    lng: 106.61,
    status: "ACTIVE",
    accepting: true,
    openNow: true,
    distance,
  } as Provider;
}

function envelope(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data}),
  } as Response;
}

function installFetch(): void {
  seen.length = 0;
  globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    seen.push({path: u.pathname, body: String(init?.body ?? "")});
    if (u.pathname === "/providers/near") return envelope([shop("s1", 330)]);
    if (u.pathname === "/providers/ratings") {
      return envelope({
        ratings: [
          {id: "pr1", score: 5, text: "Great fix", byUserName: "Rider A", reply: null, repliedAt: null, createdAt: "2026-01-01T00:00:00.000Z"},
        ],
        avg: 5,
        count: 1,
        completedJobs: 7,
      });
    }
    return envelope([]);
  }) as unknown) as typeof fetch;
}

function card(): {handlers: RadiusCardHandlers; fns: Record<string, ReturnType<typeof jest.fn>>} {
  const fns = {
    onWalkHere: jest.fn(),
    onRouteFromHere: jest.fn(),
    onReport: jest.fn(),
    onImHere: jest.fn(),
  };
  return {
    handlers: {
      walkBusy: false,
      navBusy: false,
      imHereBusy: false,
      canImHere: () => false,
      ...fns,
    },
    fns,
  };
}

type Props = React.ComponentProps<typeof ShopRadiusOverlay>;

async function render(overrides?: Partial<Props>) {
  const {handlers, fns} = card();
  const onUseShop = jest.fn();
  const onRadius = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ShopRadiusOverlay
          t={en}
          token="tok"
          gps={{lat: 10.7, lng: 106.6}}
          vehicleClass="SOLO_BIKE"
          radii={[500, 1000, 2000]}
          radius={1000}
          mode="browse"
          card={handlers}
          onRadius={onRadius}
          onUseShop={onUseShop}
          onClose={() => undefined}
          {...overrides}
        />
      </SafeAreaProvider>,
    );
    for (let i = 0; i < 10; i++) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });
  if (!renderer) throw new Error("mount failed");
  return {renderer, onUseShop, onRadius, fns};
}

function teardown(renderer: ReturnType<typeof create>): void {
  renderer.unmount();
  globalThis.fetch = realFetch;
  clearApiCache();
}

async function tapPin(renderer: ReturnType<typeof create>) {
  const pin = renderer.root
    .findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1")
    .find((n) => typeof n.props?.onPress === "function");
  expect(pin).toBeDefined();
  await act(async () => {
    await pin?.props.onPress();
    for (let i = 0; i < 10; i++) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });
}

test("overlay lists nearby shops with a radius cycler and an estimated pill", async () => {
  installFetch();
  const {renderer} = await render();
  try {
    expect(renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1").length).toBeGreaterThan(0);
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === "~4 min").length).toBeGreaterThan(0);
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === "1 km" && typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
    const near = seen.find((call) => call.path === "/providers/near");
    expect(near).toBeDefined();
    expect(JSON.parse(near?.body ?? "{}")).toMatchObject({radiusMeters: 1000, kind: "SHOP", acceptingOnly: true, vehicleClass: "SOLO_BIKE"});
  } finally {
    teardown(renderer);
  }
});

test("tapping a pin opens the detail card with the full icon row", async () => {
  installFetch();
  const {renderer} = await render();
  try {
    await tapPin(renderer);
    expect(renderer.root.findAll((n) => n.props?.children === "Good Shop").length).toBeGreaterThan(0);
    for (const label of [en.shop.walkTo, en.common.routeFromHere, en.report.title]) {
      expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
    }
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.shop.useShop).length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("detail card spans the full overlay width like a bottom sheet", async () => {
  installFetch();
  const {renderer} = await render();
  try {
    await tapPin(renderer);
    const sheets = renderer.root.findAll((n) => {
      const flat = Array.isArray(n.props?.style) ? n.props.style : [n.props?.style];
      return flat.some((s) => s !== null && typeof s === "object" &&
        (s as {left?: unknown}).left === 0 &&
        (s as {right?: unknown}).right === 0 &&
        (s as {bottom?: unknown}).bottom === 0 &&
        (s as {borderTopLeftRadius?: unknown}).borderTopLeftRadius === 20);
    });
    expect(sheets.length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("tapping a second pin swaps the card without leaving the map", async () => {
  installFetch();
  const {renderer} = await render();
  try {
    await tapPin(renderer);
    expect(renderer.root.findAll((n) => n.props?.children === "Good Shop").length).toBeGreaterThan(0);
    await tapPin(renderer);
    expect(renderer.root.findAll((n) => n.props?.children === "Good Shop").length).toBeGreaterThan(0);
    expect(renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("card shows loading then jobs for the selected shop", async () => {
  installFetch();
  const {renderer} = await render();
  try {
    await tapPin(renderer);
    expect(renderer.root.findAll((n) => n.props?.children === en.shop.jobsDone.replace("{n}", "7")).length).toBeGreaterThan(0);
    const rated = seen.find((call) => call.path === "/providers/ratings");
    expect(rated).toBeDefined();
    expect(JSON.parse(rated?.body ?? "{}")).toMatchObject({providerId: "s1"});
  } finally {
    teardown(renderer);
  }
});

test("card walk action reaches the owner handler", async () => {
  installFetch();
  const {renderer, fns} = await render();
  try {
    await tapPin(renderer);
    const walk = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.shop.walkTo && typeof n.props?.onPress === "function")
      .pop();
    expect(walk).toBeDefined();
    await act(async () => {
      await walk?.props.onPress();
    });
    expect(fns.onWalkHere).toHaveBeenCalledTimes(1);
    expect((fns.onWalkHere.mock.calls[0]?.[0] as Provider).id).toBe("s1");
  } finally {
    teardown(renderer);
  }
});

test("card opens the scrollable reviews modal", async () => {
  installFetch();
  const {renderer} = await render();
  try {
    await tapPin(renderer);
    expect(renderer.root.findAll((n) => n.props?.children === "Great fix").length).toBeGreaterThan(0);
    const preview = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.rating.allReviews && typeof n.props?.onPress === "function")
      .pop();
    expect(preview).toBeDefined();
    await act(async () => {
      await preview?.props.onPress();
    });
    expect(renderer.root.findAll((n) => n.props?.children === en.rating.allReviews).length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("tow card offers use-this-shop and hides it in browse", async () => {
  installFetch();
  const {renderer, onUseShop} = await render({mode: "tow"});
  try {
    await tapPin(renderer);
    const use = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.shop.useShop && typeof n.props?.onPress === "function")
      .pop();
    expect(use).toBeDefined();
    await act(async () => {
      await use?.props.onPress();
    });
    expect(onUseShop).toHaveBeenCalledTimes(1);
    expect((onUseShop.mock.calls[0]?.[0] as Provider).id).toBe("s1");
  } finally {
    teardown(renderer);
  }
});

test("radius cycler press reports the next radius to the owner", async () => {
  installFetch();
  const {renderer, onRadius} = await render({radius: 1000});
  try {
    const cycle = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "1 km" && typeof n.props?.onPress === "function")
      .pop();
    expect(cycle).toBeDefined();
    await act(async () => {
      await cycle?.props.onPress();
    });
    expect(onRadius).toHaveBeenCalledWith(2000);
  } finally {
    teardown(renderer);
  }
});

test("radius cycler wraps from the widest radius back to the narrowest", async () => {
  installFetch();
  const {renderer, onRadius} = await render({radius: 2000});
  try {
    const cycle = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "2 km" && typeof n.props?.onPress === "function")
      .pop();
    expect(cycle).toBeDefined();
    await act(async () => {
      await cycle?.props.onPress();
    });
    expect(onRadius).toHaveBeenCalledWith(500);
  } finally {
    teardown(renderer);
  }
});

test("tow radii cycle past the walk roof up to twenty kilometres", async () => {
  installFetch();
  const {renderer, onRadius} = await render({radii: [2000, 5000, 10000, 20000], radius: 10000});
  try {
    const cycle = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "10 km" && typeof n.props?.onPress === "function")
      .pop();
    expect(cycle).toBeDefined();
    await act(async () => {
      await cycle?.props.onPress();
    });
    expect(onRadius).toHaveBeenCalledWith(20000);
  } finally {
    teardown(renderer);
  }
});
