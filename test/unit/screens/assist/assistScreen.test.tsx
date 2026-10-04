import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {ActivityIndicator} from "react-native";
import * as Location from "expo-location";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import AssistScreen from "../../../../src/screens/AssistScreen";
import {clearApiCache} from "../../../../src/services/cache";
import {en} from "../../../../src/i18n/en";

jest.mock("../../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true, signIn: async () => undefined, signOut: async () => undefined, refreshToken: async () => null}),
}));

jest.mock("../../../../src/context/ProfileContext", () => ({
  useProfile: () => ({
    activeVehicle: {id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1},
    bundle: {user: {id: "u1", role: "2", services: ["RIDER"]}},
    refresh: async () => null,
    markOnboarded: async () => undefined,
    activateVehicle: async () => undefined,
  }),
}));

const mockNavStart = jest.fn();

jest.mock("../../../../src/context/NavSessionContext", () => ({
  useNavSession: () => ({session: null, start: mockNavStart, clear: jest.fn()}),
}));

jest.mock("../../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({navigate: mockNavigate, setOptions: jest.fn()}),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const realFetch = globalThis.fetch;
const seen: {path: string; body: string}[] = [];
let mockMine: unknown[] = [];
let mockFeed: unknown[] = [];
let mockTicketRatings: unknown[] = [];

function defaultProfile() {
  return {
    activeVehicle: {id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1},
    bundle: {user: {id: "u1", role: "2", services: ["RIDER"]}},
    refresh: async () => null,
    markOnboarded: async () => undefined,
    activateVehicle: async () => undefined,
  };
}

function resetProfile(): void {
  const mod = jest.requireMock("../../../../src/context/ProfileContext") as {useProfile: unknown};
  mod.useProfile = defaultProfile;
}

function setVehicle(type: string | null): void {
  const mod = jest.requireMock("../../../../src/context/ProfileContext") as {useProfile: unknown};
  mod.useProfile = () => ({
    ...defaultProfile(),
    activeVehicle: type ? {id: "v9", type, baseWidth: 1.9, baseHeight: 1.5} : null,
  });
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
    if (u.pathname === "/dispatch/mine") return envelope(mockMine);
    if (u.pathname === "/dispatch/feed") return envelope(mockFeed);
    if (u.pathname === "/ratings/by-ticket") return envelope(mockTicketRatings);
    if (u.pathname === "/providers/near") {
      return envelope([
        {id: "s1", kind: "SHOP", name: "Good Shop", lat: 10.71, lng: 106.61, status: "ACTIVE", accepting: true, openNow: true, distance: 330},
      ]);
    }
    if (u.pathname === "/providers/search") {
      return envelope([
        {id: "s2", kind: "SHOP", name: "Good Shop North", lat: 10.72, lng: 106.62, status: "ACTIVE", accepting: true, openNow: true, distance: 900},
      ]);
    }
    if (u.pathname === "/routes") {
      return envelope({cached: false, routes: [{source: "test", geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]}, distanceMeters: 1500, durationSeconds: 300}]});
    }
    return envelope([]);
  }) as unknown) as typeof fetch;
}

async function render(): Promise<ReturnType<typeof create>> {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <AssistScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

async function mount(): Promise<ReturnType<typeof create>> {
  mockNavigate.mockClear();
  mockNavStart.mockClear();
  mockMine = [];
  mockFeed = [];
  mockTicketRatings = [];
  resetProfile();
  clearApiCache();
  installFetch();
  return render();
}

async function mountWithVehicle(type: string | null): Promise<ReturnType<typeof create>> {
  mockNavigate.mockClear();
  mockNavStart.mockClear();
  mockMine = [];
  mockFeed = [];
  mockTicketRatings = [];
  setVehicle(type);
  clearApiCache();
  installFetch();
  return render();
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function tapTab(renderer: ReturnType<typeof create>, label: string): Promise<void> {
  const tab = texts(renderer.root, label).find((n) => typeof n.props?.onPress === "function");
  expect(tab).toBeDefined();
  await act(async () => {
    await tab?.props.onPress();
    await flush();
  });
}

async function refreshThenShops(renderer: ReturnType<typeof create>): Promise<void> {
  const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
  expect(refresh).toBeDefined();
  await act(async () => {
    await refresh?.props.onPress();
    await flush();
  });
  await tapTab(renderer, en.assist.sectionShops);
}

function teardown(renderer: ReturnType<typeof create>): void {
  renderer.unmount();
  globalThis.fetch = realFetch;
  clearApiCache();
}

async function tapShopPin(renderer: ReturnType<typeof create>): Promise<void> {
  const pin = renderer.root
    .findAll((n) => (n.props as {id?: string} | undefined)?.id === "assist-shop-s1")
    .find((n) => typeof n.props?.onPress === "function");
  expect(pin).toBeDefined();
  await act(async () => {
    await pin?.props.onPress();
    await flush();
  });
}

function sheetAction(renderer: ReturnType<typeof create>, label: string): ReactTestInstance | undefined {
  return texts(renderer.root, label).find((n) => typeof n.props?.onPress === "function");
}

function selectedLabel(renderer: ReturnType<typeof create>): string | null {
  const sel = renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "assist-shop-sel");
  if (sel.length === 0) return null;
  const data = (sel[0].props as {data?: {properties?: {walkLabel?: unknown}}}).data;
  return typeof data?.properties?.walkLabel === "string" ? data.properties.walkLabel : null;
}

function texts(root: ReactTestInstance, label: string): ReactTestInstance[] {
  return root.findAll((n) => n.props?.accessibilityLabel === label);
}

function hasText(root: ReactTestInstance, text: string): boolean {
  return root.findAll((n) => typeof n.props?.children === "string" && (n.props.children as string) === text).length > 0;
}

function hasTopOffset(style: unknown): boolean {
  const flat = Array.isArray(style) ? style : [style];
  return flat.some((s) => s !== null && typeof s === "object" && typeof (s as {top?: unknown}).top === "number");
}

test("request tab shows the request button and records tab shows empty state", async () => {
  const renderer = await mount();
  try {
    expect(texts(renderer.root, en.assist.request).length).toBeGreaterThan(0);
    expect(texts(renderer.root, en.assist.sectionRecords).length).toBeGreaterThan(0);
    await tapTab(renderer, en.assist.sectionRecords);
    expect(hasText(renderer.root, en.assist.emptyRecords)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("card has no title header in any mode", async () => {
  const renderer = await mount();
  try {
    expect(hasText(renderer.root, en.assist.title)).toBe(false);
    expect(hasText(renderer.root, en.shop.title)).toBe(false);
    await refreshThenShops(renderer);
    expect(hasText(renderer.root, en.assist.title)).toBe(false);
    expect(hasText(renderer.root, en.shop.title)).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("card container anchors from the top", async () => {
  const renderer = await mount();
  try {
    const containers = renderer.root.findAll(
      (n) => (n.type as string) === "View" && n.props?.style !== undefined && hasTopOffset(n.props.style),
    );
    expect(containers.length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("ticket type icons expose labels and checked state", async () => {
  const renderer = await mount();
  try {
    for (const label of [en.assist.sos, en.assist.tow, en.assist.mechanic]) {
      const nodes = texts(renderer.root, label).filter((n) => n.props.accessibilityState !== undefined);
      expect(nodes.length).toBeGreaterThan(0);
    }
    const sosOn = texts(renderer.root, en.assist.sos).filter((n) => n.props.accessibilityState?.checked === true);
    expect(sosOn.length).toBeGreaterThan(0);
    const towOn = texts(renderer.root, en.assist.tow).filter((n) => n.props.accessibilityState?.checked === true);
    expect(towOn.length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("shops tab shows pins and car riders see no shops tab", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    const pin = renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "assist-shop-s1");
    expect(pin.length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
  const car = await mountWithVehicle("CAR");
  try {
    expect(texts(car.root, en.assist.sectionShops).length).toBe(0);
    expect(texts(car.root, en.assist.sectionRequest).length).toBeGreaterThan(0);
    expect(texts(car.root, en.assist.sectionRecords).length).toBeGreaterThan(0);
  } finally {
    teardown(car);
  }
  const novehicle = await mountWithVehicle(null);
  try {
    await tapTab(novehicle, en.assist.sectionShops);
    expect(hasText(novehicle.root, en.shop.noVehicle)).toBe(true);
  } finally {
    teardown(novehicle);
  }
});

test("shop query filters by vehicle class", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    const near = seen.find((call) => call.path === "/providers/near");
    expect(near).toBeDefined();
    expect(JSON.parse(near?.body ?? "{}")).toMatchObject({kind: "SHOP", acceptingOnly: true, vehicleClass: "SOLO_BIKE"});
    expect(JSON.parse(near?.body ?? "{}")).not.toHaveProperty("openOnly");
  } finally {
    teardown(renderer);
  }
});

test("tapping a shop pin opens the detail sheet with all four actions", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    await tapShopPin(renderer);
    expect(sheetAction(renderer, en.report.title)).toBeDefined();
    expect(sheetAction(renderer, en.shop.walkTo)).toBeDefined();
    expect(sheetAction(renderer, en.assist.imHere)).toBeDefined();
    expect(sheetAction(renderer, en.common.routeFromHere)).toBeDefined();
    expect(selectedLabel(renderer)).toBe("4 min");
  } finally {
    teardown(renderer);
  }
});

test("walk label appears only on the selected shop", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    expect(selectedLabel(renderer)).toBeNull();
    await tapShopPin(renderer);
    expect(selectedLabel(renderer)).toMatch(/^\d+ min$/);
    const others = renderer.root.findAll(
      (n) => {
        const id = (n.props as {id?: string} | undefined)?.id ?? "";
        return typeof id === "string" && id.startsWith("assist-shop-s") && id !== "assist-shop-sel";
      },
    );
    for (const node of others) {
      const props = (node.props as {data?: {properties?: Record<string, unknown>}}).data?.properties ?? {};
      expect(props).not.toHaveProperty("walkLabel");
    }
  } finally {
    teardown(renderer);
  }
});

test("walk here closes the sheet and shows the foot preview", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    await tapShopPin(renderer);
    expect(sheetAction(renderer, en.shop.walkTo)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.shop.walkTo)?.props.onPress();
      await flush();
    });
    expect(sheetAction(renderer, en.shop.walkTo)).toBeUndefined();
    const foot = seen.find((call) => call.path === "/routes");
    expect(foot).toBeDefined();
    expect((JSON.parse(foot?.body ?? "{}") as {mode?: string}).mode).toBe("foot");
    expect(texts(renderer.root, en.common.routeFromHere).length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("route from here starts a vehicle navigation session", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    await tapShopPin(renderer);
    const nav = sheetAction(renderer, en.common.routeFromHere);
    expect(nav).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await nav?.props.onPress();
      await flush(12);
    });
    const route = seen.find((call) => call.path === "/routes");
    expect(route).toBeDefined();
    const payload = JSON.parse(route?.body ?? "{}") as Record<string, unknown>;
    expect(payload).not.toHaveProperty("mode", "foot");
    expect(payload.width).toBe(0.7);
    expect(sheetAction(renderer, en.common.routeFromHere)).toBeUndefined();
    expect(mockNavigate).toHaveBeenCalledWith("Navigation");
  } finally {
    teardown(renderer);
  }
});

test("route from here seeds a navigation session for the shop", async () => {  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    await tapShopPin(renderer);
    const nav = sheetAction(renderer, en.common.routeFromHere);
    await act(async () => {
      await nav?.props.onPress();
      await flush(12);
    });
    expect(mockNavStart).toHaveBeenCalledTimes(1);
    const session = mockNavStart.mock.calls[0]?.[0] as {dest?: {lat: number; lng: number}; stops?: unknown[]} | undefined;
    expect(session?.dest).toEqual({lat: 10.71, lng: 106.61});
    expect(session?.stops).toEqual([]);
  } finally {
    teardown(renderer);
  }
});

test("locate shows a spinner and disables while the fix is pending", async () => {
  const renderer = await mount();
  try {
    let resolveFix!: (pos: {coords: {latitude: number; longitude: number}}) => void;
    const pending = new Promise<{coords: {latitude: number; longitude: number}}>((resolve) => {
      resolveFix = resolve;
    });
    jest.mocked(Location.getCurrentPositionAsync).mockImplementationOnce(() => pending as never);
    const fab = texts(renderer.root, en.common.currentLocation).find((n) => typeof n.props?.onPress === "function");
    expect(fab).toBeDefined();
    await act(async () => {
      await fab?.props.onPress();
      await flush(2);
    });
    const busy = texts(renderer.root, en.common.currentLocation).find((n) => typeof n.props?.onPress === "function");
    expect(busy?.props.disabled).toBe(true);
    expect(busy?.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    await act(async () => {
      resolveFix({coords: {latitude: 10.7, longitude: 106.6}});
      await flush(4);
    });
    const idle = texts(renderer.root, en.common.currentLocation).find((n) => typeof n.props?.onPress === "function");
    expect(idle?.props.disabled).toBe(false);
    expect(idle?.findAllByType(ActivityIndicator).length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("refresh shows a spinner and disables while reloading", async () => {
  const renderer = await mount();
  try {
    let resolveMine!: (res: Response) => void;
    const minePending = new Promise<Response>((resolve) => {
      resolveMine = resolve;
    });
    globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(String(url));
      seen.push({path: u.pathname, body: String(init?.body ?? "")});
      if (u.pathname === "/dispatch/mine") return minePending;
      if (u.pathname === "/providers/near") {
        return envelope([
          {id: "s1", kind: "SHOP", name: "Good Shop", lat: 10.71, lng: 106.61, status: "ACTIVE", accepting: true, openNow: true, distance: 330},
        ]);
      }
      return envelope([]);
    }) as unknown) as typeof fetch;
    const fab = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    expect(fab).toBeDefined();
    await act(async () => {
      await fab?.props.onPress();
      await flush(2);
    });
    const busy = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    expect(busy?.props.disabled).toBe(true);
    expect(busy?.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    await act(async () => {
      resolveMine(envelope([]));
      await flush(8);
    });
    const idle = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    expect(idle?.props.disabled).toBe(false);
    expect(idle?.findAllByType(ActivityIndicator).length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("i'm here posts a walk-in ticket and jumps to records", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    await tapShopPin(renderer);
    const here = sheetAction(renderer, en.assist.imHere);
    expect(here).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await here?.props.onPress();
      await flush(8);
    });
    const posted = seen.find((call) => call.path === "/dispatch");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketType: "WALK_IN", providerId: "s1"});
    expect(sheetAction(renderer, en.assist.imHere)).toBeUndefined();
    expect(hasText(renderer.root, en.assist.checkedIn)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("shop search fires on a debounced non-empty query", async () => {
  const renderer = await mount();
  try {
    await refreshThenShops(renderer);
    seen.length = 0;
    const input = texts(renderer.root, en.shop.searchPlaceholder).find((n) => typeof n.props?.onChangeText === "function");
    expect(input).toBeDefined();
    await act(async () => {
      await input?.props.onChangeText("Good");
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
    });
    await act(async () => {
      await flush(20);
    });
    const search = seen.find((call) => call.path === "/providers/search");
    expect(search).toBeDefined();
    expect(JSON.parse(search?.body ?? "{}")).toMatchObject({query: "Good", vehicleClass: "SOLO_BIKE"});
    expect(hasText(renderer.root, "Good Shop North")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("records row offers cancel behind a confirmation dialog", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", note: "Help", direction: "out"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    expect(hasText(renderer.root, "SOS · Pending")).toBe(true);
    const cancel = sheetAction(renderer, en.assist.cancel);
    expect(cancel).toBeDefined();
    await act(async () => {
      await cancel?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.assist.cancelTitle)).toBe(true);
    const confirm = sheetAction(renderer, en.assist.confirmCancel);
    expect(confirm).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await confirm?.props.onPress();
      await flush();
    });
    const cancelled = seen.find((call) => call.path === "/dispatch/status");
    expect(cancelled).toBeDefined();
    expect(JSON.parse(cancelled?.body ?? "{}")).toMatchObject({ticketId: "t1", status: "5"});
  } finally {
    teardown(renderer);
  }
});

test("records row rates a resolved ticket", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "4", assignedUid: "vol1", direction: "out"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    const rate = sheetAction(renderer, en.assist.rate);
    expect(rate).toBeDefined();
    await act(async () => {
      await rate?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.rating.submit)).toBe(true);
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.rating.submit)?.props.onPress();
      await flush();
    });
    const rated = seen.find((call) => call.path === "/ratings");
    expect(rated).toBeDefined();
    expect(JSON.parse(rated?.body ?? "{}")).toMatchObject({targetId: "vol1", targetKind: "VOLUNTEER", ticketId: "t9", score: 5});
    expect(hasText(renderer.root, en.rating.sent)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("records filter pills split incoming and outgoing", async () => {
  const renderer = await mount();
  try {
    mockFeed = [
      {id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", direction: "out"},
      {id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in"},
    ];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    expect(hasText(renderer.root, "SOS · Pending")).toBe(true);
    expect(hasText(renderer.root, "Walk-in · Pending")).toBe(true);
    await tapTab(renderer, en.assist.filterIn);
    expect(hasText(renderer.root, "Walk-in · Pending")).toBe(true);
    expect(hasText(renderer.root, "SOS · Pending")).toBe(false);
    await tapTab(renderer, en.assist.filterOut);
    expect(hasText(renderer.root, "SOS · Pending")).toBe(true);
    expect(hasText(renderer.root, "Walk-in · Pending")).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("incoming walk-in accepts from the records row", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    const accept = sheetAction(renderer, en.assist.accept);
    expect(accept).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await accept?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/accept");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", shopId: "shop9"});
  } finally {
    teardown(renderer);
  }
});

test("incoming walk-in declines with a reason", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    const decline = texts(renderer.root, en.provider.decline).find((n) => typeof n.props?.onPress === "function");
    expect(decline).toBeDefined();
    await act(async () => {
      await decline?.props.onPress();
      await flush();
    });
    expect(texts(renderer.root, en.assist.declineFull).length).toBeGreaterThan(0);
    seen.length = 0;
    await act(async () => {
      const confirm = texts(renderer.root, en.provider.decline).filter((n) => typeof n.props?.onPress === "function").pop();
      await confirm?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/decline");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", shopId: "shop9", reason: "FULL"});
  } finally {
    teardown(renderer);
  }
});

test("incoming job edits the work order", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    const edit = sheetAction(renderer, en.provider.saveWork);
    expect(edit).toBeDefined();
    await act(async () => {
      await edit?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.provider.quotedAmount)).toBe(true);
    seen.length = 0;
    await act(async () => {
      const save = texts(renderer.root, en.provider.saveWork).filter((n) => typeof n.props?.onPress === "function").pop();
      await save?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/work");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2"});
  } finally {
    teardown(renderer);
  }
});

test("incoming resolved job replies and rates the rider", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in"}];
    mockTicketRatings = [{id: "r1", targetId: "shop9", targetKind: "SHOP", score: 5, reply: null, repliedAt: null}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    const reply = sheetAction(renderer, en.rating.replyTitle);
    expect(reply).toBeDefined();
    await act(async () => {
      await reply?.props.onPress();
      await flush();
    });
    expect(seen.some((call) => call.path === "/ratings/by-ticket")).toBe(true);
    const send = sheetAction(renderer, en.rating.sendReply);
    expect(send).toBeDefined();
    await act(async () => {
      await send?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.rating.replyPlaceholder)).toBe(false);
    const input = renderer.root.findAll((n) => n.props?.placeholder === en.rating.replyPlaceholder).find((n) => typeof n.props?.onChangeText === "function");
    expect(input).toBeDefined();
    await act(async () => {
      await input?.props.onChangeText("Thanks!");
      await flush();
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.rating.sendReply)?.props.onPress();
      await flush();
    });
    const replied = seen.find((call) => call.path === "/ratings/reply");
    expect(replied).toBeDefined();
    expect(JSON.parse(replied?.body ?? "{}")).toMatchObject({ratingId: "r1", reply: "Thanks!"});
    const rate = sheetAction(renderer, en.assist.rate);
    expect(rate).toBeDefined();
    await act(async () => {
      await rate?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.rating.submit)).toBe(true);
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.rating.submit)?.props.onPress();
      await flush();
    });
    const rated = seen.find((call) => call.path === "/ratings");
    expect(rated).toBeDefined();
    expect(JSON.parse(rated?.body ?? "{}")).toMatchObject({targetId: "rider2", targetKind: "RIDER", ticketId: "t2"});
  } finally {
    teardown(renderer);
  }
});
