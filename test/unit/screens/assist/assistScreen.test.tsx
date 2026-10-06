import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {ActivityIndicator} from "react-native";
import * as Location from "expo-location";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import AssistScreen from "../../../../src/screens/AssistScreen";
import {clearApiCache} from "../../../../src/services/cache";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";

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
    hasVehicle: true,
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
    hasVehicle: type !== null,
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
    if (u.pathname === "/vehicleProfiles/all") {
      return envelope([
        {id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1},
        {id: "v2", type: "CUB", baseWidth: 0.7, baseHeight: 1.1},
      ]);
    }
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


async function openRecord(renderer: ReturnType<typeof create>, title: string): Promise<void> {
  const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
  await act(async () => {
    await refresh?.props.onPress();
    await flush();
  });
  await tapTab(renderer, en.assist.sectionRecords);
  const row = texts(renderer.root, title).find((n) => typeof n.props?.onPress === "function");
  expect(row).toBeDefined();
  await act(async () => {
    await row?.props.onPress();
    await flush();
  });
}

async function refreshThenBrowse(renderer: ReturnType<typeof create>): Promise<void> {
  const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
  expect(refresh).toBeDefined();
  await act(async () => {
    await refresh?.props.onPress();
    await flush();
  });
  const mechanic = texts(renderer.root, en.assist.mechanic).find((n) => typeof n.props?.onPress === "function");
  expect(mechanic).toBeDefined();
  await act(async () => {
    await mechanic?.props.onPress();
    await flush();
  });
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

function pillLabels(renderer: ReturnType<typeof create>): string[] {
  const labels = renderer.root
    .findAll((n) => typeof n.props?.onPress === "function" && typeof n.props?.accessibilityLabel === "string" && /^~\d+ min$/.test(n.props.accessibilityLabel as string))
    .map((n) => n.props.accessibilityLabel as string);
  return [...new Set(labels)];
}

function selectedLabel(renderer: ReturnType<typeof create>): string | null {
  const sels = renderer.root.findAll((n) => {
    if (typeof n.props?.onPress !== "function" || typeof n.props?.accessibilityLabel !== "string") return false;
    if (!/^~\d+ min$/.test(n.props.accessibilityLabel as string)) return false;
    const flat = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
    return flat.some((s) => s !== null && typeof s === "object" && (s as {backgroundColor?: unknown}).backgroundColor === lightTheme.primary);
  });
  const unique = [...new Set(sels.map((n) => n.props.accessibilityLabel as string))];
  return unique.length > 0 ? unique[0] : null;
}

function shopPills(renderer: ReturnType<typeof create>): string[] {
  return pillLabels(renderer);
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

test("request tab opens a ticket modal from the sos button", async () => {
  const renderer = await mount();
  try {
    expect(texts(renderer.root, en.assist.sectionRecords).length).toBeGreaterThan(0);
    const sos = texts(renderer.root, en.assist.sos).find((n) => typeof n.props?.onPress === "function");
    expect(sos).toBeDefined();
    await act(async () => {
      await sos?.props.onPress();
      await flush();
    });
    const input = renderer.root.findAll((n) => n.props?.placeholder === en.assist.note).find((n) => typeof n.props?.onChangeText === "function");
    expect(input).toBeDefined();
    await act(async () => {
      await input?.props.onChangeText("Flat tire");
      await flush();
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush(8);
    });
    const posted = seen.find((call) => call.path === "/dispatch");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketType: "SOS", note: "Flat tire"});
    expect(hasText(renderer.root, en.assist.requested)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("tow ticket modal requires a destination", async () => {
  const renderer = await mount();
  try {
    const tow = texts(renderer.root, en.assist.tow).find((n) => typeof n.props?.onPress === "function");
    expect(tow).toBeDefined();
    await act(async () => {
      await tow?.props.onPress();
      await flush();
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush();
    });
    expect(seen.some((call) => call.path === "/dispatch")).toBe(false);
    expect(hasText(renderer.root, en.assist.towNeedsDest)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("card has no title header in any mode", async () => {
  const renderer = await mount();
  try {
    expect(hasText(renderer.root, en.assist.title)).toBe(false);
    expect(hasText(renderer.root, en.shop.title)).toBe(false);
    await refreshThenBrowse(renderer);
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

test("ticket type icons expose labels with nothing preselected", async () => {
  const renderer = await mount();
  try {
    for (const label of [en.assist.sos, en.assist.tow, en.assist.mechanic]) {
      const nodes = texts(renderer.root, label).filter((n) => n.props.accessibilityState !== undefined);
      expect(nodes.length).toBeGreaterThan(0);
    }
    for (const label of [en.assist.sos, en.assist.tow, en.assist.mechanic]) {
      const on = texts(renderer.root, label).filter((n) => n.props.accessibilityState?.checked === true);
      expect(on.length).toBe(0);
    }
  } finally {
    teardown(renderer);
  }
});

test("mechanic browse shows pins and car riders see no mechanic button", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    const pin = renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "assist-shop-s1");
    expect(pin.length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
  const car = await mountWithVehicle("CAR");
  try {
    expect(texts(car.root, en.assist.mechanic).length).toBe(0);
    expect(texts(car.root, en.assist.sos).length).toBeGreaterThan(0);
    expect(texts(car.root, en.assist.tow).length).toBeGreaterThan(0);
    expect(texts(car.root, en.assist.sectionRequest).length).toBeGreaterThan(0);
    expect(texts(car.root, en.assist.sectionRecords).length).toBeGreaterThan(0);
  } finally {
    teardown(car);
  }
  const novehicle = await mountWithVehicle(null);
  try {
    const refresh = texts(novehicle.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const mechanic = texts(novehicle.root, en.assist.mechanic).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await mechanic?.props.onPress();
      await flush();
    });
    expect(hasText(novehicle.root, en.shop.noVehicle)).toBe(true);
  } finally {
    teardown(novehicle);
  }
});

test("tow button renders a tow-truck glyph", async () => {
  const renderer = await mount();
  try {
    const glyphs = renderer.root.findAll((n) => n.props?.name === "tow-truck");
    expect(glyphs.length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("shop query filters by vehicle class", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    const near = seen.find((call) => call.path === "/providers/near");
    expect(near).toBeDefined();
    expect(JSON.parse(near?.body ?? "{}")).toMatchObject({kind: "SHOP", acceptingOnly: true, vehicleClass: "SOLO_BIKE"});
    expect(JSON.parse(near?.body ?? "{}")).not.toHaveProperty("openOnly");
  } finally {
    teardown(renderer);
  }
});

test("tapping a shop pin opens the detail sheet with icon actions", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    await tapShopPin(renderer);
    expect(sheetAction(renderer, en.report.title)).toBeDefined();
    expect(sheetAction(renderer, en.shop.walkTo)).toBeDefined();
    expect(sheetAction(renderer, en.common.routeFromHere)).toBeDefined();
    expect(sheetAction(renderer, en.assist.imHere)).toBeUndefined();
    expect(texts(renderer.root, en.shop.bothClasses).length).toBeGreaterThan(0);
    expect(hasText(renderer.root, en.shop.shopClosed)).toBe(false);
    expect(hasText(renderer.root, "0.3 km")).toBe(false);
    expect(selectedLabel(renderer)).toBe("~4 min");
  } finally {
    teardown(renderer);
  }
});

test("every listed shop carries an estimated pill", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    expect(shopPills(renderer)).toEqual(["~4 min"]);
    await tapShopPin(renderer);
    expect(selectedLabel(renderer)).toMatch(/^~\d+ min$/);
  } finally {
    teardown(renderer);
  }
});

test("walk here closes the sheet and shows the foot preview", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
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
    await refreshThenBrowse(renderer);
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
    await refreshThenBrowse(renderer);
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
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({coords: {latitude: 10.71, longitude: 106.61}} as never);
    await refreshThenBrowse(renderer);
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
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({coords: {latitude: 10.7, longitude: 106.6}} as never);
    teardown(renderer);
  }
});

test("shop search fires on a debounced non-empty query", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
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
    mockFeed = [{id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", note: "Help", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Pending");
    expect(hasText(renderer.root, "Help")).toBe(true);
    const cancel = sheetAction(renderer, en.assist.cancel);
    expect(cancel).toBeDefined();
    await act(async () => {
      await cancel?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.assist.cancelMessage)).toBe(true);
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
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "4", assignedUid: "vol1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Resolved");
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
      {id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"},
      {id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in", otherParty: {id: "rider2", name: "Rider Two", kind: "RIDER"}, createdAt: "2026-01-02T00:00:00.000Z"},
    ];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    expect(hasText(renderer.root, "SOS")).toBe(true);
    expect(hasText(renderer.root, "Walk-in")).toBe(true);
    expect(hasText(renderer.root, "Rider Two")).toBe(true);
    await tapTab(renderer, en.assist.filterIn);
    expect(hasText(renderer.root, "Walk-in")).toBe(true);
    expect(hasText(renderer.root, "SOS")).toBe(false);
    await tapTab(renderer, en.assist.filterOut);
    expect(hasText(renderer.root, "SOS")).toBe(true);
    expect(hasText(renderer.root, "Walk-in")).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("incoming walk-in accepts from the records row", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in", otherParty: {id: "rider2", name: "Rider Two", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Pending");
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
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Pending");
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
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
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
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockTicketRatings = [{id: "r1", targetId: "shop9", targetKind: "SHOP", score: 5, reply: null, repliedAt: null}];
    await openRecord(renderer, "Walk-in · Resolved");
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

test("vehicle button opens the picker and activates", async () => {
  const renderer = await mount();
  try {
    const btn = texts(renderer.root, en.vehicle.myVehicle).find((n) => typeof n.props?.onPress === "function");
    expect(btn).toBeDefined();
    await act(async () => {
      await btn?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.vehicle.title)).toBe(true);
    seen.length = 0;
    const flatText = (node: ReactTestInstance): string =>
      node.findAll((n) => typeof n.props?.children === "string").map((n) => n.props.children as string).join(" ");
    const rows = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityRole === "button");
    const cub = rows.find((n) => flatText(n).includes("Cub"));
    expect(cub).toBeDefined();
    await act(async () => {
      await cub?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.vehicle.activeSaved)).toBe(true);
    expect(hasText(renderer.root, en.vehicle.title)).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("cancelling the ticket modal restores the previous kind", async () => {
  const renderer = await mount();
  try {
    const sosOn = () => texts(renderer.root, en.assist.sos).filter((n) => n.props.accessibilityState?.checked === true);
    const towOn = () => texts(renderer.root, en.assist.tow).filter((n) => n.props.accessibilityState?.checked === true);
    expect(sosOn().length).toBe(0);
    expect(towOn().length).toBe(0);
    const tow = texts(renderer.root, en.assist.tow).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await tow?.props.onPress();
      await flush();
    });
    expect(towOn().length).toBeGreaterThan(0);
    await act(async () => {
      await sheetAction(renderer, en.common.cancel)?.props.onPress();
      await flush();
    });
    expect(sosOn().length).toBe(0);
    expect(towOn().length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("search and radius share one filter row", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    const input = texts(renderer.root, en.shop.searchPlaceholder).find((n) => typeof n.props?.onChangeText === "function");
    const cycle = texts(renderer.root, "1 km").find((n) => typeof n.props?.onPress === "function");
    expect(input).toBeDefined();
    expect(cycle).toBeDefined();
    const row = (cycle as ReactTestInstance).parent;
    expect(row?.findAll((n) => n === input).length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("tapping a minutes pill opens the shop sheet", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    const pill = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "~4 min")
      .find((n) => {
        const flat = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
        return !flat.some((s) => s !== null && typeof s === "object" && (s as {backgroundColor?: unknown}).backgroundColor === lightTheme.primary);
      });
    expect(pill).toBeDefined();
    await act(async () => {
      await pill?.props.onPress();
      await flush();
    });
    expect(sheetAction(renderer, en.common.routeFromHere)).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

function rowBorder(renderer: ReturnType<typeof create>, title: string): unknown {
  const row = texts(renderer.root, title).find((n) => typeof n.props?.onPress === "function");
  const card = row?.findAll((n) => Array.isArray(n.props?.style) && n.props.style.some((s: unknown) => s !== null && typeof s === "object" && "borderColor" in (s as Record<string, unknown>))).pop();
  const flat = (Array.isArray(card?.props.style) ? card?.props.style : []) as Record<string, unknown>[];
  return flat.find((s) => s !== null && typeof s === "object" && "borderColor" in s)?.borderColor;
}

test("opening a record shows only the sheet, not the map card", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", note: "Help", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Pending");
    expect(rowBorder(renderer, "SOS · Pending")).toBe(lightTheme.border);
    expect(hasText(renderer.root, "Help")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("record sheet shows the shop block from enriched parties", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t1", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "out", otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP", label: "12 Le Loi", openNow: true, ratingAvg: 4.5, ratingCount: 12}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    expect(hasText(renderer.root, "12 Le Loi")).toBe(true);
    expect(hasText(renderer.root, en.shop.open)).toBe(true);
    const joined = renderer.root
      .findAll((n) => Array.isArray(n.props?.children))
      .map((n) => (n.props.children as unknown[]).join(""));
    expect(joined.some((s) => s.includes("4.5") && s.includes("12"))).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("record sheet renders the status timeline", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z", statusHistory: [{status: "1", at: "2026-01-01T00:00:00.000Z", by: "u1"}, {status: "2", at: "2026-01-01T01:00:00.000Z", by: "op1"}]}];
    await openRecord(renderer, "Walk-in · Matched");
    expect(hasText(renderer.root, en.assist.statusAccepted)).toBe(true);
    expect(hasText(renderer.root, en.assist.statusPending)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("shop sheet carries the status pill without the closed line", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    await tapShopPin(renderer);
    expect(hasText(renderer.root, en.shop.open)).toBe(true);
    const joined = renderer.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string)
      .join("\n");
    expect(joined).not.toContain("Closes in");
  } finally {
    teardown(renderer);
  }
});

test("declining a request closes the detail sheet", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Pending");
    const decline = texts(renderer.root, en.provider.decline).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await decline?.props.onPress();
      await flush();
    });
    await act(async () => {
      const confirm = texts(renderer.root, en.provider.decline).filter((n) => typeof n.props?.onPress === "function").pop();
      await confirm?.props.onPress();
      await flush();
    });
    expect(sheetAction(renderer, en.assist.accept)).toBeUndefined();
    expect(sheetAction(renderer, en.provider.decline)).toBeUndefined();
    expect(texts(renderer.root, "Walk-in · Pending").filter((n) => typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("inbound sheet shows the rider location block", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in", otherParty: {id: "rider2", name: "Rider Two", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Pending");
    expect(hasText(renderer.root, "Rider Two")).toBe(true);
    expect(hasText(renderer.root, "10.70000, 106.60000")).toBe(true);
  } finally {
    teardown(renderer);
  }
});
