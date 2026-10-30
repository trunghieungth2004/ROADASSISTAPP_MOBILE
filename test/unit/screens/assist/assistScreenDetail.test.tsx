import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";

import AsyncStorage from "@react-native-async-storage/async-storage";

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
    activeVehicle: {id: "v1", type: "BIKE", baseWidth: 0.7, baseHeight: 1.1},
    bundle: {user: {id: "u1", role: "2", services: ["RIDER"]}},
    refresh: async () => null,
    markOnboarded: async () => undefined,
    activateVehicle: async () => undefined,
  }),
}));

const mockNavStart = jest.fn();
export let mockCheckedIn = false;
const mockSetCheckedIn = jest.fn((value: boolean) => {
  mockCheckedIn = value;
});
export let mockNavEnded = false;
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
export let mockMine: unknown[] = [];
export let mockFeed: unknown[] = [];
export let mockTicketRatings: unknown[] = [];
export let mockOwnProviders: unknown[] = [];
export let mockNear: unknown[] = [];
export let mockClosesIn: number | null = null;
export let mockOne: unknown = {id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7"};

export function defaultProfile() {
  return {
    activeVehicle: {id: "v1", type: "BIKE", baseWidth: 0.7, baseHeight: 1.1},
    hasVehicle: true,
    bundle: {user: {id: "u1", role: "2", services: ["RIDER"]}},
    refresh: async () => null,
    markOnboarded: async () => undefined,
    activateVehicle: async () => undefined,
  };
}

export function resetProfile(): void {
  const mod = jest.requireMock("../../../../src/context/ProfileContext") as {useProfile: unknown};
  mod.useProfile = defaultProfile;
}

export function setVehicle(type: string | null): void {
  const mod = jest.requireMock("../../../../src/context/ProfileContext") as {useProfile: unknown};
  mod.useProfile = () => ({
    ...defaultProfile(),
    activeVehicle: type ? {id: "v9", type, baseWidth: 1.9, baseHeight: 1.5} : null,
    hasVehicle: type !== null,
  });
}

export function setServices(services: string[]): void {
  const mod = jest.requireMock("../../../../src/context/ProfileContext") as {useProfile: unknown};
  mod.useProfile = () => ({
    ...defaultProfile(),
    bundle: {user: {id: "u1", role: "2", services}},
  });
}

export function envelope(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data}),
  } as Response;
}

export function installFetch(): void {
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
        {id: "v1", type: "BIKE", baseWidth: 0.7, baseHeight: 1.1},
        {id: "v2", type: "CAR", baseWidth: 1.9, baseHeight: 1.5},
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

export async function render(): Promise<ReturnType<typeof create>> {
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

export async function mount(initialCheckedIn = false, services: string[] | null = null, initialNavEnded = false): Promise<ReturnType<typeof create>> {
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

export async function mountWithVehicle(type: string | null): Promise<ReturnType<typeof create>> {
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

export async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export async function tapTab(renderer: ReturnType<typeof create>, label: string): Promise<void> {
  const tab = texts(renderer.root, label).find((n) => typeof n.props?.onPress === "function");
  expect(tab).toBeDefined();
  await act(async () => {
    await tab?.props.onPress();
    await flush();
  });
}


export async function openRecord(renderer: ReturnType<typeof create>, title: string): Promise<void> {
  const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
  await act(async () => {
    await refresh?.props.onPress();
    await flush();
  });
  await expandIfCollapsed(renderer);
  await tapTab(renderer, en.assist.sectionRecords);
  const row = texts(renderer.root, title).find((n) => typeof n.props?.onPress === "function");
  expect(row).toBeDefined();
  await act(async () => {
    await row?.props.onPress();
    await flush();
  });
}

export async function refreshThenBrowse(renderer: ReturnType<typeof create>): Promise<void> {
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

export function teardown(renderer: ReturnType<typeof create>): void {
  renderer.unmount();
  globalThis.fetch = realFetch;
  clearApiCache();
}

export async function expandIfCollapsed(renderer: ReturnType<typeof create>): Promise<void> {
  const expand = texts(renderer.root, en.assist.expandPanel).find((n) => typeof n.props?.onPress === "function");
  if (!expand) return;
  await act(async () => {
    await expand?.props.onPress();
    await flush();
  });
}

export async function openRadiusOverlay(renderer: ReturnType<typeof create>): Promise<void> {
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

export async function tapRadiusPin(renderer: ReturnType<typeof create>): Promise<void> {
  const pin = renderer.root
    .findAll((n) => (n.props as {id?: string} | undefined)?.id === "radius-shop-s1")
    .find((n) => typeof n.props?.onPress === "function");
  expect(pin).toBeDefined();
  await act(async () => {
    await pin?.props.onPress();
    await flush();
  });
}

export async function pickRadiusShop(renderer: ReturnType<typeof create>): Promise<void> {
  await openRadiusOverlay(renderer);
  await tapRadiusPin(renderer);
  await flush(12);
}

export function sheetAction(renderer: ReturnType<typeof create>, label: string): ReactTestInstance | undefined {
  return texts(renderer.root, label).find((n) => typeof n.props?.onPress === "function");
}

export function actionLabels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string" && n.props?.accessibilityRole === "button")
    .map((n) => n.props.accessibilityLabel as string);
}

export function pillLabels(renderer: ReturnType<typeof create>): string[] {
  const labels = renderer.root
    .findAll((n) => typeof n.props?.onPress === "function" && typeof n.props?.accessibilityLabel === "string" && /^~\d+ min$/.test(n.props.accessibilityLabel as string))
    .map((n) => n.props.accessibilityLabel as string);
  return [...new Set(labels)];
}

export function selectedLabel(renderer: ReturnType<typeof create>): string | null {
  const sels = renderer.root.findAll((n) => {
    if (typeof n.props?.onPress !== "function" || typeof n.props?.accessibilityLabel !== "string") return false;
    if (!/^~\d+ min$/.test(n.props.accessibilityLabel as string)) return false;
    const flat = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
    return flat.some((s) => s !== null && typeof s === "object" && (s as {backgroundColor?: unknown}).backgroundColor === lightTheme.primary);
  });
  const unique = [...new Set(sels.map((n) => n.props.accessibilityLabel as string))];
  return unique.length > 0 ? unique[0] : null;
}

export function shopPills(renderer: ReturnType<typeof create>): string[] {
  return pillLabels(renderer);
}

export function texts(root: ReactTestInstance, label: string): ReactTestInstance[] {
  return root.findAll((n) => n.props?.accessibilityLabel === label);
}

export function hasText(root: ReactTestInstance, text: string): boolean {
  return root.findAll((n) => typeof n.props?.children === "string" && (n.props.children as string) === text).length > 0;
}

export function flatText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join(" ");
  if (node && typeof node === "object") {
    const el = node as {props?: {children?: unknown}};
    return flatText(el.props?.children);
  }
  return "";
}

export function hasTopOffset(style: unknown): boolean {
  const flat = Array.isArray(style) ? style : [style];
  return flat.some((s) => s !== null && typeof s === "object" && typeof (s as {top?: unknown}).top === "number");
}


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

test("record sheet renders the status history strip", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t2", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z", statusHistory: [{status: "1", at: "2026-01-01T00:00:00.000Z", by: "u1"}, {status: "2", at: "2026-01-01T01:00:00.000Z", by: "op1"}]}];
    await openRecord(renderer, "Walk-in · Matched");
    expect(hasText(renderer.root, en.assist.statusAccepted)).toBe(true);
    const history = renderer.root.findAll((n) => typeof n.props?.accessibilityLabel === "string" && (n.props.accessibilityLabel as string).includes(en.assist.statusPending));
    expect(history.length).toBeGreaterThan(0);
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

test("shop jobs quote before work starts", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    expect(sheetAction(renderer, en.assist.startWork)).toBeUndefined();
    expect(sheetAction(renderer, en.assist.sendQuote)).toBeDefined();
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

test("shop sends a binding quote from the work sheet", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Matched");
    const open = sheetAction(renderer, en.assist.sendQuote);
    expect(open).toBeDefined();
    await act(async () => {
      await open?.props.onPress();
      await flush();
    });
    const inputs = renderer.root.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.placeholder === "0");
    expect(inputs.length).toBeGreaterThan(0);
    await act(async () => {
      await inputs[0]?.props.onChangeText("150000");
      await flush();
    });
    seen.length = 0;
    const submits = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.sendQuote && typeof n.props?.onPress === "function");
    await act(async () => {
      await submits.pop()?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/quote");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", quotedAmount: 150000});
  } finally {
    teardown(renderer);
  }
});

test("shop records work-done details from the sheet", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "6", providerId: "shop9", assignedShopId: "shop9", shopQuotedAmount: 150000, direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · In progress");
    expect(sheetAction(renderer, en.assist.sendQuote)).toBeUndefined();
    const open = sheetAction(renderer, en.provider.workDone);
    expect(open).toBeDefined();
    await act(async () => {
      await open?.props.onPress();
      await flush();
    });
    const invoice = renderer.root.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.placeholder === en.provider.invoicePlaceholder)[0];
    expect(invoice).toBeDefined();
    await act(async () => {
      await invoice?.props.onChangeText("INV-9");
      await flush();
    });
    seen.length = 0;
    const submits = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.provider.saveWork && typeof n.props?.onPress === "function");
    await act(async () => {
      await submits.pop()?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/work");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t2", invoiceRef: "INV-9"});
  } finally {
    teardown(renderer);
  }
});

test("destination shop sends an estimate from the modal", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t4", userId: "rider4", ticketType: "TOW", lat: 10.7, lng: 106.6, status: "2", destinationShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Matched");
    const open = sheetAction(renderer, en.assist.sendEstimate);
    expect(open).toBeDefined();
    await act(async () => {
      await open?.props.onPress();
      await flush();
    });
    const amount = renderer.root.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.placeholder === "0")[0];
    expect(amount).toBeDefined();
    await act(async () => {
      await amount?.props.onChangeText("150000");
      await flush();
    });
    expect(renderer.root.findAll((n) => n.props?.value === "150,000").length).toBeGreaterThan(0);
    seen.length = 0;
    const submits = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.sendEstimate && typeof n.props?.onPress === "function");
    await act(async () => {
      await submits.pop()?.props.onPress();
      await flush();
    });
    const posted = seen.find((call) => call.path === "/dispatch/estimate");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "t4", estimateAmount: 150000});
  } finally {
    teardown(renderer);
  }
});

test("rider approves a pending quote", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "9", providerId: "shop9", assignedShopId: "shop9", shopQuotedAmount: 150000, paymentMethod: "CASH", paymentStatus: "PENDING", direction: "out", otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
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

test("an unfunded quote approval opens the bill", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "9", providerId: "shop9", assignedShopId: "shop9", shopQuotedAmount: 150000, direction: "out", otherParty: {id: "shop9", name: "Fix Shop", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Quoted");
    seen.length = 0;
    mockNavigate.mockClear();
    await act(async () => {
      await sheetAction(renderer, en.assist.payToApprove)?.props.onPress();
      await flush();
    });
    expect(seen.find((call) => call.path === "/dispatch/quote/approve")).toBeUndefined();
    expect(mockNavigate).toHaveBeenCalledWith("BillDetail", {ticketId: "t9", payFirst: true});
  } finally {
    teardown(renderer);
  }
});

test("rider resolves a ready ticket from the sheet", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "7", assignedShopId: "shop9", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
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
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "4", assignedShopId: "shop9", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
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
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: {id: "rider2", name: "Rider Two", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockTicketRatings = [];
    await openRecord(renderer, "Walk-in · Resolved");
    expect(sheetAction(renderer, en.assist.rateRider)).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

