import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {ActivityIndicator} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import AssistScreen from "../../../../src/screens/AssistScreen";
import {clearApiCache} from "../../../../src/services/cache";
import {clearGeocodeCache} from "../../../../src/api/places";
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
let mockCheckedIn = false;
const mockSetCheckedIn = jest.fn((value: boolean) => {
  mockCheckedIn = value;
});
let mockNavEnded = false;
const mockSetNavEnded = jest.fn((value: boolean) => {
  mockNavEnded = value;
});

jest.mock("../../../../src/context/NavSessionContext", () => ({
  useNavSession: () => ({session: null, start: mockNavStart, clear: jest.fn(), checkedIn: mockCheckedIn, setCheckedIn: mockSetCheckedIn, navEnded: mockNavEnded, setNavEnded: mockSetNavEnded}),
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
let mockOwnProviders: unknown[] = [];
let mockNear: unknown[] = [];
let mockClosesIn: number | null = null;
let mockOne: unknown = {id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7"};

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

function setServices(services: string[]): void {
  const mod = jest.requireMock("../../../../src/context/ProfileContext") as {useProfile: unknown};
  mod.useProfile = () => ({
    ...defaultProfile(),
    bundle: {user: {id: "u1", role: "2", services}},
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
    if (u.pathname === "/dispatch/one") return envelope(mockOne);
    if (u.pathname === "/dispatch/feed") return envelope(mockFeed);
    if (u.pathname === "/dispatch/near") return envelope(mockNear);
    if (u.pathname === "/providers/mine") return envelope(mockOwnProviders);
    if (u.pathname === "/ratings/by-ticket") return envelope(mockTicketRatings);
    if (u.pathname === "/providers/ratings") {
      return envelope({
        ratings: [
          {id: "pr1", score: 5, text: "Great fix", byUserName: "Rider A", reply: null, repliedAt: null, createdAt: "2026-01-01T00:00:00.000Z"},
          {id: "pr2", score: 4, text: null, reply: null, repliedAt: null, createdAt: "2026-01-02T00:00:00.000Z"},
        ],
        avg: 4.5,
        count: 2,
        completedJobs: 7,
      });
    }
    if (u.pathname === "/vehicleProfiles/all") {
      return envelope([
        {id: "v1", type: "SCOOTER", baseWidth: 0.7, baseHeight: 1.1},
        {id: "v2", type: "CUB", baseWidth: 0.7, baseHeight: 1.1},
      ]);
    }
    if (u.pathname === "/providers/near") {
      return envelope([
        {id: "s1", kind: "SHOP", name: "Good Shop", lat: 10.71, lng: 106.61, status: "ACTIVE", accepting: true, openNow: true, distance: 330, ...(mockClosesIn === null ? {} : {closesInMinutes: mockClosesIn})},
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

async function mount(initialCheckedIn = false, services: string[] | null = null, initialNavEnded = false): Promise<ReturnType<typeof create>> {
  mockNavigate.mockClear();
  mockNavStart.mockClear();
  mockSetCheckedIn.mockClear();
  mockCheckedIn = initialCheckedIn;
  mockSetNavEnded.mockClear();
  mockNavEnded = initialNavEnded;
  mockMine = [];
  mockFeed = [];
  mockTicketRatings = [];
  mockOwnProviders = [];
  mockNear = [];
  mockClosesIn = null;
  mockOne = {id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7"};
  await AsyncStorage.clear().catch(() => undefined);
  resetProfile();
  if (services) setServices(services);
  clearApiCache();
  installFetch();
  return render();
}

async function mountWithVehicle(type: string | null): Promise<ReturnType<typeof create>> {
  mockNavigate.mockClear();
  mockNavStart.mockClear();
  mockSetCheckedIn.mockClear();
  mockCheckedIn = false;
  mockSetNavEnded.mockClear();
  mockNavEnded = false;
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

async function openRadiusOverlay(renderer: ReturnType<typeof create>): Promise<void> {
  const field = texts(renderer.root, en.shop.searchPlaceholder).find((n) => typeof n.props?.onPress === "function");
  expect(field).toBeDefined();
  await act(async () => {
    await field?.props.onPress();
    await flush();
  });
  const near = renderer.root
    .findAll((n) => typeof n.props?.onPress === "function" && flatText(n.props?.children).includes(en.shop.nearbyShops));
  expect(near.length).toBeGreaterThan(0);
  await act(async () => {
    await near[0].props.onPress();
    await flush(12);
  });
}

async function tapRadiusPin(renderer: ReturnType<typeof create>): Promise<void> {
  const pin = renderer.root
    .findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1")
    .find((n) => typeof n.props?.onPress === "function");
  expect(pin).toBeDefined();
  await act(async () => {
    await pin?.props.onPress();
    await flush();
  });
}

async function pickRadiusShop(renderer: ReturnType<typeof create>): Promise<void> {
  await openRadiusOverlay(renderer);
  await tapRadiusPin(renderer);
  await flush(12);
}

function sheetAction(renderer: ReturnType<typeof create>, label: string): ReactTestInstance | undefined {
  return texts(renderer.root, label).find((n) => typeof n.props?.onPress === "function");
}

function actionLabels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string" && n.props?.accessibilityRole === "button")
    .map((n) => n.props.accessibilityLabel as string);
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

function flatText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join(" ");
  if (node && typeof node === "object") {
    const el = node as {props?: {children?: unknown}};
    return flatText(el.props?.children);
  }
  return "";
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
    await tapTab(renderer, en.assist.sectionTow);
    const towButtons = texts(renderer.root, en.assist.tow).filter((n) => typeof n.props?.onPress === "function");
    const tow = towButtons.pop();
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
    await openRadiusOverlay(renderer);
    const pin = renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1");
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
    await tapTab(renderer, en.assist.sectionTow);
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
    seen.length = 0;
    await openRadiusOverlay(renderer);
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
    await pickRadiusShop(renderer);
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
    await openRadiusOverlay(renderer);
    expect(shopPills(renderer)).toEqual(["~4 min"]);
    await tapRadiusPin(renderer);
    await flush(12);
    expect(selectedLabel(renderer)).toMatch(/^~\d+ min$/);
  } finally {
    teardown(renderer);
  }
});

test("closing shop warns before the walk preview and goes on confirm", async () => {
  const renderer = await mount();
  try {
    mockClosesIn = 3;
    await refreshThenBrowse(renderer);
    await pickRadiusShop(renderer);
    expect(sheetAction(renderer, en.shop.walkTo)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.shop.walkTo)?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.shop.closingSoonTitle)).toBe(true);
    const routed = (root: ReactTestInstance): boolean =>
      root.findAll((n) => flatText(n.props?.children).includes(en.shop.walkRoute)).length > 0;
    expect(routed(renderer.root)).toBe(false);
    const go = texts(renderer.root, en.shop.closingGo).find((n) => typeof n.props?.onPress === "function");
    expect(go).toBeDefined();
    await act(async () => {
      await go?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.shop.closingSoonTitle)).toBe(false);
    expect(sheetAction(renderer, en.shop.walkTo)).toBeUndefined();
    expect(routed(renderer.root)).toBe(true);
    const foot = seen.find((call) => call.path === "/routes");
    expect(foot).toBeDefined();
    expect((JSON.parse(foot?.body ?? "{}") as {mode?: string}).mode).toBe("foot");
  } finally {
    teardown(renderer);
  }
});

test("closing shop warns before navigation and drives on confirm", async () => {
  const renderer = await mount();
  try {
    mockClosesIn = 3;
    await refreshThenBrowse(renderer);
    await pickRadiusShop(renderer);
    const nav = sheetAction(renderer, en.common.routeFromHere);
    expect(nav).toBeDefined();
    await act(async () => {
      await nav?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.shop.closingSoonTitle)).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalledWith("Navigation");
    const go = texts(renderer.root, en.shop.closingGo).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await go?.props.onPress();
      await flush(12);
    });
    expect(mockNavigate).toHaveBeenCalledWith("Navigation");
    expect(mockNavStart).toHaveBeenCalledTimes(1);
  } finally {
    teardown(renderer);
  }
});

test("walk here closes the sheet and shows the foot preview", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    await pickRadiusShop(renderer);
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
    await pickRadiusShop(renderer);
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
    await pickRadiusShop(renderer);
    const nav = sheetAction(renderer, en.common.routeFromHere);
    await act(async () => {
      await nav?.props.onPress();
      await flush(12);
    });
    expect(mockNavStart).toHaveBeenCalledTimes(1);
    const session = mockNavStart.mock.calls[0]?.[0] as {dest?: {lat: number; lng: number}; stops?: unknown[]; checkIn?: {providerId: string; name: string}} | undefined;
    expect(session?.dest).toEqual({lat: 10.71, lng: 106.61});
    expect(session?.stops).toEqual([]);
    expect(session?.checkIn).toEqual({providerId: "s1", name: "Good Shop"});
  } finally {
    teardown(renderer);
  }
});

test("navigator check-in lands on records with a notice", async () => {
  const renderer = await mount(true);
  try {
    const records = texts(renderer.root, en.assist.sectionRecords).find((n) => n.props?.accessibilityState?.selected === true);
    expect(records).toBeDefined();
    expect(hasText(renderer.root, en.assist.checkedIn)).toBe(true);
    expect(mockSetCheckedIn).toHaveBeenCalledWith(false);
  } finally {
    teardown(renderer);
  }
});

test("cancelled navigation lands on records with a notice", async () => {
  const renderer = await mount(false, null, true);
  try {
    const records = texts(renderer.root, en.assist.sectionRecords).find((n) => n.props?.accessibilityState?.selected === true);
    expect(records).toBeDefined();
    expect(hasText(renderer.root, en.nav.requestCancelled)).toBe(true);
    expect(mockSetNavEnded).toHaveBeenCalledWith(false);
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
    let resolveFeed!: (res: Response) => void;
    const feedPending = new Promise<Response>((resolve) => {
      resolveFeed = resolve;
    });
    globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(String(url));
      seen.push({path: u.pathname, body: String(init?.body ?? "")});
      if (u.pathname === "/dispatch/feed") return feedPending;
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
      resolveFeed(envelope([]));
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
    await pickRadiusShop(renderer);
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

test("assist place search offers map pick and confirms into the map selection", async () => {
  await clearGeocodeCache();
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    const field = texts(renderer.root, en.shop.searchPlaceholder).find((n) => typeof n.props?.onPress === "function");
    expect(field).toBeDefined();
    await act(async () => {
      await field?.props.onPress();
      await flush();
    });
    const pickOnMap = renderer.root.findAll(
      (n) => typeof n.props?.onPress === "function" && flatText(n.props?.children).includes(en.route.pickOnMap),
    );
    expect(pickOnMap.length).toBeGreaterThan(0);
    globalThis.fetch = (jest.fn(async () => ({ok: true, json: async () => ({features: [{place_name: "Mock Drop Point"}]})}) as Response)) as unknown as typeof fetch;
    await act(async () => {
      await pickOnMap[0].props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.route.pickOnMap)).toBe(false);
    const confirm = renderer.root.findAll(
      (n) => n.props?.accessibilityLabel === en.provider.useThisLocation && typeof n.props?.onPress === "function",
    );
    expect(confirm.length).toBeGreaterThan(0);
    await act(async () => {
      await confirm[0].props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, "Mock Drop Point")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("shop search fires on a debounced non-empty query", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    seen.length = 0;
    const field = texts(renderer.root, en.shop.searchPlaceholder).find((n) => typeof n.props?.onPress === "function");
    expect(field).toBeDefined();
    await act(async () => {
      await field?.props.onPress();
      await flush();
    });
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
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
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
    const rate = sheetAction(renderer, en.assist.rateRider);
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

test("cancelling the ticket modal closes it", async () => {
  const renderer = await mount();
  try {
    await tapTab(renderer, en.assist.sectionTow);
    const towButtons = texts(renderer.root, en.assist.tow).filter((n) => typeof n.props?.onPress === "function");
    const tow = towButtons.pop();
    expect(tow).toBeDefined();
    await act(async () => {
      await tow?.props.onPress();
      await flush();
    });
    expect(sheetAction(renderer, en.assist.request)).toBeDefined();
    await act(async () => {
      await sheetAction(renderer, en.common.cancel)?.props.onPress();
      await flush();
    });
    expect(sheetAction(renderer, en.assist.request)).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("search row has no radius cycler and the nearby overlay owns the radius chips", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    expect(texts(renderer.root, "1 km").filter((n) => typeof n.props?.onPress === "function").length).toBe(0);
    await openRadiusOverlay(renderer);
    expect(texts(renderer.root, "1 km").filter((n) => typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("radius cycler switch refetches nearby shops at the new radius", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    seen.length = 0;
    await openRadiusOverlay(renderer);
    const cycle = texts(renderer.root, "1 km").find((n) => typeof n.props?.onPress === "function");
    expect(cycle).toBeDefined();
    await act(async () => {
      await cycle?.props.onPress();
      await flush(12);
    });
    const near = seen.filter((call) => call.path === "/providers/near").pop();
    expect(near).toBeDefined();
    expect(JSON.parse(near?.body ?? "{}")).toMatchObject({radiusMeters: 2000});
  } finally {
    teardown(renderer);
  }
});

test("tow nearby overlay cycles past two kilometres up to the twenty roof", async () => {
  const renderer = await mount();
  try {
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const towButtons = texts(renderer.root, en.assist.tow).filter((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await towButtons.pop()?.props.onPress();
      await flush();
    });
    const field = texts(renderer.root, en.common.searchPlaceholder).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await field?.props.onPress();
      await flush();
    });
    const near = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && flatText(n.props?.children).includes(en.shop.nearbyShops));
    await act(async () => {
      await near[0].props.onPress();
      await flush(12);
    });
    expect(texts(renderer.root, "5 km").filter((n) => typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
    seen.length = 0;
    for (const label of ["5 km", "10 km"]) {
      const cycle = texts(renderer.root, label).find((n) => typeof n.props?.onPress === "function");
      expect(cycle).toBeDefined();
      await act(async () => {
        await cycle?.props.onPress();
        await flush(12);
      });
    }
    const far = seen.filter((call) => call.path === "/providers/near").pop();
    expect(far).toBeDefined();
    expect(JSON.parse(far?.body ?? "{}")).toMatchObject({radiusMeters: 20000});
  } finally {
    teardown(renderer);
  }
});

test("tow radius pick opens the details sheet with a drop-off action", async () => {
  const renderer = await mount();
  try {
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const towButtons = texts(renderer.root, en.assist.tow).filter((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await towButtons.pop()?.props.onPress();
      await flush();
    });
    const field = texts(renderer.root, en.common.searchPlaceholder).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await field?.props.onPress();
      await flush();
    });
    const near = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && flatText(n.props?.children).includes(en.shop.nearbyShops));
    expect(near.length).toBeGreaterThan(0);
    await act(async () => {
      await near[0].props.onPress();
      await flush(12);
    });
    const pin = renderer.root
      .findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1")
      .find((n) => typeof n.props?.onPress === "function");
    expect(pin).toBeDefined();
    await act(async () => {
      await pin?.props.onPress();
      await flush(12);
    });
    const use = texts(renderer.root, en.shop.useShop).find((n) => typeof n.props?.onPress === "function");
    expect(use).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await use?.props.onPress();
      await flush();
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketType: "TOW", destinationShopId: "s1"});
  } finally {
    teardown(renderer);
  }
});

test("tapping a minutes pill opens the shop sheet", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    await openRadiusOverlay(renderer);
    const pill = renderer.root
      .findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "~4 min")
      .find((n) => {
        const flat = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
        return !flat.some((s) => s !== null && typeof s === "object" && (s as {backgroundColor?: unknown}).backgroundColor === lightTheme.primary);
      });
    expect(pill).toBeDefined();
    await act(async () => {
      await pill?.props.onPress();
      await flush(12);
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

test("tapping the drop-off card opens the shop modal", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "TOW", lat: 10.7, lng: 106.6, status: "2", providerId: "tow7", assignedShopId: "tow7", destinationShopId: "shop-1", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"}, destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Matched");
    expect(hasText(renderer.root, en.assist.dropOffPoint)).toBe(true);
    const card = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "Fix Shop" && typeof n.props?.onPress === "function")
      .pop();
    expect(card).toBeDefined();
    await act(async () => {
      await card?.props.onPress();
      await flush(12);
    });
    expect(texts(renderer.root, en.shop.walkTo).filter((n) => typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("tapping the party shop card opens the shop modal", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t8", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "out", otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65, label: "12 Le Loi", openNow: true}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    const card = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "Fix Shop" && typeof n.props?.onPress === "function")
      .pop();
    expect(card).toBeDefined();
    await act(async () => {
      await card?.props.onPress();
      await flush(12);
    });
    expect(texts(renderer.root, en.shop.walkTo).filter((n) => typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("record sheet shows the shop block from enriched parties", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t1", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "out", otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP", label: "12 Le Loi", openNow: true, ratingAvg: 4.5, ratingCount: 12, phone: "+84111"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    expect(hasText(renderer.root, "12 Le Loi")).toBe(true);
    expect(hasText(renderer.root, en.shop.open)).toBe(true);
    expect(hasText(renderer.root, "+84111")).toBe(true);
    const joined = renderer.root
      .findAll((n) => Array.isArray(n.props?.children))
      .map((n) => (n.props.children as unknown[]).join(""));
    expect(joined.some((s) => s.includes("4.5"))).toBe(true);
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
    await pickRadiusShop(renderer);
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

test("operator advances matched to in-progress from the sheet", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    const start = sheetAction(renderer, en.assist.startWork);
    expect(start).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await start?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/status");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", status: "6"});
    expect(sheetAction(renderer, en.assist.startWork)).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

test("operator marks in-progress jobs ready from the sheet", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "6", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · In progress");
    expect(sheetAction(renderer, en.assist.markReady)).toBeDefined();
    expect(sheetAction(renderer, en.assist.startWork)).toBeUndefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.markReady)?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/status");
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", status: "7"});
  } finally {
    teardown(renderer);
  }
});

test("shop sends a quote from the work form", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    const edit = sheetAction(renderer, en.provider.saveWork);
    await act(async () => {
      await edit?.props.onPress();
      await flush();
    });
    const inputs = renderer.root.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.placeholder === en.provider.quotedAmount);
    expect(inputs.length).toBeGreaterThan(0);
    await act(async () => {
      await inputs[0]?.props.onChangeText("150000");
      await flush();
    });
    expect(sheetAction(renderer, en.assist.sendQuote)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.sendQuote)?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/quote");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", quotedAmount: 150000});
  } finally {
    teardown(renderer);
  }
});

test("rider approves a pending quote", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "9", providerId: "shop9", assignedShopId: "shop9", shopQuotedAmount: 150000, direction: "out", otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Quoted");
    expect(sheetAction(renderer, en.assist.approveQuote)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.approveQuote)?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/quote/approve");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t9"});
  } finally {
    teardown(renderer);
  }
});

test("rider resolves a ready ticket from the sheet", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "7", assignedUid: "vol1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Ready");
    expect(sheetAction(renderer, en.assist.resolved)).toBeDefined();
    expect(sheetAction(renderer, en.assist.rate)).toBeUndefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.resolved)?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/status");
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t9", status: "4"});
  } finally {
    teardown(renderer);
  }
});

test("quoted amounts lock in the work form", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "6", providerId: "shop9", assignedShopId: "shop9", shopQuotedAmount: 150000, direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · In progress");
    const edit = sheetAction(renderer, en.provider.saveWork);
    await act(async () => {
      await edit?.props.onPress();
      await flush();
    });
    const quoteInput = renderer.root.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.placeholder === en.provider.quotedAmount);
    expect(quoteInput.every((n) => n.props?.editable === false)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("shop block opens the modal where routing to the shop lives", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t1", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "out", providerSnapshot: {id: "shop9", name: "Fix Shop", lat: 10.71, lng: 106.61, kind: "SHOP"}, otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP", lat: 10.71, lng: 106.61, label: "12 Le Loi"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    const card = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === "Fix Shop" && typeof n.props?.onPress === "function")
      .pop();
    expect(card).toBeDefined();
    await act(async () => {
      await card?.props.onPress();
      await flush(12);
    });
    const route = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === en.common.routeFromHere);
    expect(route.length).toBeGreaterThan(0);
    seen.length = 0;
    await act(async () => {
      await route[0]?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/routes");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({destLat: 10.71, destLng: 106.61});
  } finally {
    teardown(renderer);
  }
});

test("rated tickets offer edit rating with comment", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "4", assignedUid: "vol1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Resolved");
    await act(async () => {
      await sheetAction(renderer, en.assist.rate)?.props.onPress();
      await flush();
    });
    const inputs = renderer.root.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.placeholder === en.rating.commentPlaceholder);
    expect(inputs.length).toBeGreaterThan(0);
    await act(async () => {
      await inputs[0]?.props.onChangeText("Great help");
      await flush();
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.rating.submit)?.props.onPress();
      await flush();
    });
    const rated = seen.find((call) => call.path === "/ratings");
    expect(JSON.parse(rated?.body ?? "{}")).toMatchObject({ticketId: "t9", score: 5, text: "Great help"});
    await openRecord(renderer, "SOS · Resolved");
    expect(sheetAction(renderer, en.rating.editRating)).toBeDefined();
    expect(sheetAction(renderer, en.assist.rate)).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("reply affordance hides on own ratings", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockTicketRatings = [
      {id: "r1", targetId: "shop9", targetKind: "SHOP", byUserId: "u1", byUserName: "Me", score: 5, text: "Fixed fast", reply: null, repliedAt: null},
      {id: "r2", targetId: "shop9", targetKind: "SHOP", byUserId: "rider9", byUserName: "Rider Nine", score: 4, text: null, reply: null, repliedAt: null},
    ];
    await openRecord(renderer, "Walk-in · Resolved");
    expect(hasText(renderer.root, "Fixed fast")).toBe(true);
    const replies = texts(renderer.root, en.rating.sendReply).filter((n) => typeof n.props?.onPress === "function");
    expect(replies).toHaveLength(1);
  } finally {
    teardown(renderer);
  }
});

test("shop sheet shows done jobs beside the rating", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    await pickRadiusShop(renderer);
    expect(hasText(renderer.root, en.shop.jobsDone.replace("{n}", "7"))).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("shop preview opens the scrollable reviews modal", async () => {
  const renderer = await mount();
  try {
    await refreshThenBrowse(renderer);
    await pickRadiusShop(renderer);
    expect(hasText(renderer.root, "Great fix")).toBe(true);
    const preview = texts(renderer.root, en.rating.allReviews).find((n) => typeof n.props?.onPress === "function");
    expect(preview).toBeDefined();
    await act(async () => {
      await preview?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.rating.allReviews)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("rating rows show author faces and names", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockTicketRatings = [
      {id: "r1", targetId: "shop9", targetKind: "SHOP", byUserId: "rider9", byUserName: "Rider Nine", score: 5, text: "Fixed fast", reply: "Thanks", repliedByName: "Fix Shop", repliedAt: null},
    ];
    await openRecord(renderer, "Walk-in · Resolved");
    expect(hasText(renderer.root, en.rating.yourRating)).toBe(true);
    expect(hasText(renderer.root, "Rider Nine")).toBe(true);
    expect(hasText(renderer.root, "R")).toBe(true);
    expect(hasText(renderer.root, "Fix Shop")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("inbound sheet shows the rider stars", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: {id: "rider2", name: "Rider Two", kind: "RIDER", ratingAvg: 4, ratingCount: 5}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    const joined = renderer.root
      .findAll((n) => Array.isArray(n.props?.children))
      .map((n) => (n.props.children as unknown[]).join(""));
    expect(joined.some((s) => s.includes("4.0") && s.includes("5"))).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("shop side rates the rider under its own label", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: {id: "rider2", name: "Rider Two", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockTicketRatings = [];
    await openRecord(renderer, "Walk-in · Resolved");
    expect(sheetAction(renderer, en.assist.rateRider)).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

test("tow destination picks a registered shop from fullscreen search", async () => {
  const renderer = await mount();
  try {
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const towButtons = texts(renderer.root, en.assist.tow).filter((n) => typeof n.props?.onPress === "function");
    const tow = towButtons.pop();
    expect(tow).toBeDefined();
    await act(async () => {
      await tow?.props.onPress();
      await flush();
    });
    const field = texts(renderer.root, en.common.searchPlaceholder).find((n) => typeof n.props?.onPress === "function");
    expect(field).toBeDefined();
    await act(async () => {
      await field?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.assist.dropOffPoint)).toBe(true);
    expect(texts(renderer.root, en.shop.searchPlaceholder).filter((n) => typeof n.props?.onChangeText === "function").length).toBe(0);
    const input = texts(renderer.root, en.route.searchDestination).find((n) => typeof n.props?.onChangeText === "function");
    expect(input).toBeDefined();
    await act(async () => {
      await input?.props.onChangeText("Good");
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    await act(async () => {});
    await act(async () => {
      await flush(20);
    });
    const pick = texts(renderer.root, "Good Shop North").find((n) => typeof n.props?.onPress === "function");
    expect(pick).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await pick?.props.onPress();
      await flush();
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketType: "TOW", destinationShopId: "s2"});
  } finally {
    teardown(renderer);
  }
});

test("dual-role operators toggle shop and tow rows", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [
      {id: "shop9", kind: "SHOP", status: "ACTIVE"},
      {id: "tow7", kind: "TOW", status: "ACTIVE"},
    ];
    mockFeed = [
      {id: "t1", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "1", providerId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"},
      {id: "t2", userId: "rider3", ticketType: "TOW", lat: 10.7, lng: 106.6, status: "1", providerId: "tow7", direction: "in", otherParty: null, createdAt: "2026-01-02T00:00:00.000Z"},
    ];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    expect(hasText(renderer.root, "Walk-in")).toBe(true);
    const towRows = () => texts(renderer.root, "Tow · Pending").filter((n) => typeof n.props?.onPress === "function");
    expect(towRows().length).toBeGreaterThan(0);
    const towChip = texts(renderer.root, en.assist.typeTow).find(
      (n) => typeof n.props?.onPress === "function" && n.props?.accessibilityState !== undefined && n.props?.accessibilityRole !== "tab",
    );
    expect(towChip).toBeDefined();
    await act(async () => {
      await towChip?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, "Walk-in")).toBe(true);
    expect(towRows()).toHaveLength(0);
  } finally {
    teardown(renderer);
  }
});

test("rider-only users see no kind chips", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    const chipLike = (n: {props?: {onPress?: unknown; accessibilityState?: unknown; accessibilityRole?: unknown}}) =>
      typeof n.props?.onPress === "function" && n.props?.accessibilityState !== undefined && n.props?.accessibilityRole !== "tab";
    expect(texts(renderer.root, en.assist.typeTow).filter(chipLike)).toHaveLength(0);
    expect(texts(renderer.root, en.shop.title).filter(chipLike)).toHaveLength(0);
  } finally {
    teardown(renderer);
  }
});

test("rider chip toggles kind-less rows", async () => {
  const renderer = await mount();
  try {
    mockFeed = [
      {id: "t1", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"},
      {id: "t2", userId: "u1", ticketType: "TOW", lat: 10.7, lng: 106.6, status: "1", direction: "out", otherParty: null, createdAt: "2026-01-02T00:00:00.000Z"},
    ];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionRecords);
    expect(hasText(renderer.root, "SOS")).toBe(true);
    const riderChip = texts(renderer.root, en.assist.filterRider).find(
      (n) => typeof n.props?.onPress === "function" && n.props?.accessibilityState !== undefined && n.props?.accessibilityRole !== "tab",
    );
    expect(riderChip).toBeDefined();
    await act(async () => {
      await riderChip?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, "SOS")).toBe(false);
    expect(hasText(renderer.root, "Tow")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("tow section boards nearby tow jobs for towers", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    expect(hasText(renderer.root, "Stuck")).toBe(true);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    expect(row).toBeDefined();
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    expect(sheetAction(renderer, en.assist.accept)).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

test("tow board accept posts the caller's tower", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    expect(sheetAction(renderer, en.assist.accept)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/accept");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t5", shopId: "tow7"});
  } finally {
    teardown(renderer);
  }
});

test("tow board accept omits the shop for volunteers", async () => {
  const renderer = await mount(false, ["RIDER", "VOLUNTEER"]);
  try {
    mockNear = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/accept");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t5"});
    expect(JSON.parse(posted?.body ?? "{}")).not.toHaveProperty("shopId");
  } finally {
    teardown(renderer);
  }
});

test("record accept falls back to the own tower on provider-less tows", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockFeed = [{id: "t6", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Pending");
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/accept");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t6", shopId: "tow7"});
  } finally {
    teardown(renderer);
  }
});

test("shop-only viewer gets a truthful message on provider-less tows", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t6", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Pending");
    seen.length = 0;
    const accept = sheetAction(renderer, en.assist.accept);
    expect(accept).toBeDefined();
    expect(accept?.props.disabled).toBe(true);
    expect(hasText(renderer.root, en.assist.towAcceptHint)).toBe(true);
    await act(async () => {
      await accept?.props.onPress();
      await flush(12);
    });
    expect(seen.find((call) => call.path === "/dispatch/accept")).toBeUndefined();
    expect(hasText(renderer.root, en.assist.towOperatorsOnly)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("volunteer record accept posts without a shop", async () => {
  const renderer = await mount(false, ["RIDER", "VOLUNTEER"]);
  try {
    mockFeed = [{id: "t6", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Pending");
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/accept");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t6"});
    expect(JSON.parse(posted?.body ?? "{}")).not.toHaveProperty("shopId");
  } finally {
    teardown(renderer);
  }
});

test("tow board row opens the request modal with rider details", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", riderName: "Rider Nine", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck", vehicleType: "SCOOTER", distance: 1500, destinationSnapshot: {lat: 10.75, lng: 106.65, label: "Home garage", source: "point"}}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    expect(row).toBeDefined();
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, "Rider Nine")).toBe(true);
    expect(hasText(renderer.root, en.roles.rider)).toBe(true);
    expect(hasText(renderer.root, en.assist.pickup)).toBe(true);
    expect(hasText(renderer.root, "Home garage")).toBe(true);
    expect(hasText(renderer.root, en.assist.dropOffPoint)).toBe(true);
    expect(sheetAction(renderer, en.assist.accept)).toBeDefined();
    expect(sheetAction(renderer, en.provider.decline)).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("tow board rows show glyph, pill and distance", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck", distance: 1500}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    expect(renderer.root.findAll((n) => n.props?.name === "tow-truck").length).toBeGreaterThan(0);
    expect(hasText(renderer.root, en.shop.radiusKm.replace("{n}", "1.5"))).toBe(true);
    expect(hasText(renderer.root, "10.71000, 106.61000")).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("unnamed board rider shows the role instead of unassigned", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.assist.unassigned)).toBe(false);
    expect(hasText(renderer.root, en.roles.rider)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("tower-held tow hides the shop workbench", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockFeed = [{id: "t7", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Matched");
    expect(texts(renderer.root, en.provider.saveWork).filter((n) => typeof n.props?.onPress === "function").length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("shop-held ticket keeps the shop workbench", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t8", userId: "rider9", ticketType: "WALK_IN", lat: 10.71, lng: 106.61, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    expect(texts(renderer.root, en.provider.saveWork).filter((n) => typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("rider marks arrival and resolution from the ticket modal", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t3", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Matched");
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.arrived)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/status");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t3", status: "3"});
  } finally {
    teardown(renderer);
  }
});

test("tower active job shows a buttonless mini card into the modal", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", riderName: "Rider Nine", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    mockFeed = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    expect(mockNavigate).toHaveBeenCalledWith("Navigation");
    expect(mockNavStart).toHaveBeenCalledTimes(1);
    expect(texts(renderer.root, en.assist.arrived).filter((n) => typeof n.props?.onPress === "function").length).toBe(0);
    expect(texts(renderer.root, en.assist.resolved).filter((n) => typeof n.props?.onPress === "function").length).toBe(0);
    expect(hasText(renderer.root, "Rider Nine")).toBe(true);
    const mini = texts(renderer.root, "Tow · Matched").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    await act(async () => {
      await mini?.props.onPress();
      await flush(12);
    });
    const nav = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.common.routeFromHere && typeof n.props?.onPress === "function")
      .pop();
    expect(nav).toBeDefined();
    await act(async () => {
      await nav?.props.onPress();
      await flush(12);
    });
    expect(mockNavStart).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith("Navigation");
  } finally {
    teardown(renderer);
  }
});

test("tow board modal accept posts the caller's tower", async () => {

  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", riderName: "Rider Nine", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/accept");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t5", shopId: "tow7"});
    expect(mockNavigate).toHaveBeenCalledWith("Navigation");
    expect(mockNavStart).toHaveBeenCalledTimes(1);
    const session = mockNavStart.mock.calls[0]?.[0] as {dest?: {lat: number; lng: number}; stops?: unknown[]} | undefined;
    expect(session?.dest).toEqual({lat: 10.71, lng: 106.61});
    expect(session?.stops).toEqual([]);
  } finally {
    teardown(renderer);
  }
});

test("tow board modal shows the whole-way preview and its map", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t5", userId: "rider9", riderName: "Rider Nine", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck", destinationSnapshot: {lat: 10.75, lng: 106.65, label: "Home garage", source: "point"}}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const row = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.assist.towRoutePreview)).toBe(true);
    const routed = renderer.root.findAll((n) => flatText(n.props?.children).includes(en.assist.towViaPickup));
    expect(routed.length).toBeGreaterThan(0);
    expect(hasText(renderer.root, "1.5 km · 5 min via pickup")).toBe(true);
    const labels = actionLabels(renderer);
    expect(labels).toContain(en.assist.accept);
    expect(labels).toContain(en.assist.towRoutePreview);
    expect(labels.indexOf(en.assist.accept)).toBeLessThan(labels.indexOf(en.assist.towRoutePreview));
    const preview = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.towRoutePreview && typeof n.props?.onPress === "function")
      .pop();
    expect(preview).toBeDefined();
    await act(async () => {
      await preview?.props.onPress();
      await flush(12);
    });
    expect(renderer.root.findAll((n) => (n.props as {id?: string} | undefined)?.id === "tow-preview-dest").length).toBeGreaterThan(0);
    seen.length = 0;
    const accept = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.assist.accept && typeof n.props?.onPress === "function")
      .pop();
    await act(async () => {
      await accept?.props.onPress();
      await flush(12);
    });
    expect(seen.find((call) => call.path === "/dispatch/accept")).toBeDefined();
    expect(mockNavigate).toHaveBeenCalledWith("Navigation");
    expect(mockNavStart).toHaveBeenCalledTimes(1);
    const session = mockNavStart.mock.calls[0]?.[0] as {dest?: {lat: number; lng: number}; stops?: unknown[]} | undefined;
    expect(session?.dest).toEqual({lat: 10.75, lng: 106.65});
    expect(session?.stops).toEqual([{lat: 10.71, lng: 106.61}]);
  } finally {
    teardown(renderer);
  }
});
