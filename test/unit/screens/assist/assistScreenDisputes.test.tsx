import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import AssistScreen from "../../../../src/screens/AssistScreen";
import {clearApiCache} from "../../../../src/services/cache";

import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";

const apiPath = (u: URL): string => u.pathname.replace(/^\/api/, "");

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
    seen.push({path: apiPath(u), body: String(init?.body ?? "")});
    if (apiPath(u) === "/dispatch/mine") return envelope(mockMine);
    if (apiPath(u) === "/dispatch/one") return envelope(mockOne);
    if (apiPath(u) === "/dispatch/feed") return envelope(mockFeed);
    if (apiPath(u) === "/payments/create") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {ticketId?: string; method?: string};
      return envelope({
        id: "pay1",
        ticketId: body.ticketId ?? "t1",
        method: body.method ?? "SEPAY",
        status: "PENDING",
        amount: 150000,
        checkout: {qrUrl: "https://pay.example/checkout"},
      });
    }
    if (apiPath(u) === "/payments/cancel") {
      return envelope({cancelled: true, method: "SEPAY"});
    }
    if (apiPath(u) === "/payments/one") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {ticketId?: string};
      return envelope([{
        id: "pay1",
        ticketId: body.ticketId ?? "t1",
        method: "SEPAY",
        status: "HELD",
        amount: 150000,
      }]);
    }
    if (apiPath(u) === "/dispatch/near") return envelope(mockNear);
    if (apiPath(u) === "/providers/mine") return envelope(mockOwnProviders);
    if (apiPath(u) === "/ratings/by-ticket") return envelope(mockTicketRatings);
    if (apiPath(u) === "/providers/ratings") {
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
    if (apiPath(u) === "/vehicleProfiles/all") {
      return envelope([
        {id: "v1", type: "BIKE", baseWidth: 0.7, baseHeight: 1.1},
        {id: "v2", type: "CAR", baseWidth: 1.9, baseHeight: 1.5},
      ]);
    }
    if (apiPath(u) === "/providers/near") {
      return envelope([
        {id: "s1", kind: "SHOP", name: "Good Shop", lat: 10.71, lng: 106.61, status: "ACTIVE", accepting: true, openNow: true, distance: 330, ...(mockClosesIn === null ? {} : {closesInMinutes: mockClosesIn})},
      ]);
    }
    if (apiPath(u) === "/providers/search") {
      return envelope([
        {id: "s2", kind: "SHOP", name: "Good Shop North", lat: 10.72, lng: 106.62, status: "ACTIVE", accepting: true, openNow: true, distance: 900},
      ]);
    }
    if (apiPath(u) === "/routes") {
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


test("dispute hold hides resolve and shows the review banner", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos5", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "7", assignedShopId: "mobile1", finalAmount: 120000, disputeHold: true, dispute: {id: "d1", status: "OPEN", type: "SERVICE_QUALITY", reasonCode: "SERVICE_NOT_DONE", filedBy: "u1", accusedKind: "SHOP", accusedId: "mobile1", hold: true, at: "2026-01-01T00:00:00.000Z"}, direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Work done");
    expect(sheetAction(renderer, en.assist.resolved)).toBeUndefined();
    expect(hasText(renderer.root, en.assist.disputeUnderReview)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("rider SOS arrived shows dispute, chat, and resolved after the fix fee", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos4", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "3", assignedShopId: "mobile1", finalAmount: 120000, direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Arrived");
    expect(sheetAction(renderer, en.assist.resolved)).toBeDefined();
    expect(sheetAction(renderer, en.assist.disputeTicket)).toBeDefined();
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.chat.open && typeof n.props?.onPress === "function").length).toBeGreaterThan(0);
    expect(sheetAction(renderer, en.assist.startWork)).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("mobile shop SOS matched offers cancel and no can't fix", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "mobile1", kind: "MOBILE_SHOP", status: "ACTIVE", accepting: true}];
    mockFeed = [{id: "sos5", userId: "rider9", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "mobile1", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · On the way");
    expect(sheetAction(renderer, en.assist.unfixableAction)).toBeUndefined();
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
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/status");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "sos5", status: "5"});
  } finally {
    teardown(renderer);
  }
});

test("mobile shop SOS arrived sends a fix quote without completing it", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "mobile1", kind: "MOBILE_SHOP", status: "ACTIVE", accepting: true}];
    mockFeed = [{id: "sos3", userId: "rider9", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "3", assignedShopId: "mobile1", finalAmount: 120000, direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Arrived");
    expect(sheetAction(renderer, en.assist.fixComplete)).toBeDefined();
    expect(sheetAction(renderer, en.assist.unfixableAction)).toBeDefined();
    expect(sheetAction(renderer, en.assist.cancel)).toBeUndefined();
    expect(sheetAction(renderer, en.assist.mobileFixAction)).toBeUndefined();
    expect(sheetAction(renderer, en.assist.startWork)).toBeUndefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.fixComplete)?.props.onPress();
      await flush(12);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.mobileFixSave)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch/mobile-shop/fix");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketId: "sos3", fixAmount: 120000});
    expect(seen.find((call) => call.path === "/dispatch/status")).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("rider approves or declines a mobile fix from the quoted SOS", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos9", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "9", assignedShopId: "mobile1", finalAmount: 120000, direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Quoted");
    expect(sheetAction(renderer, en.assist.approve)).toBeDefined();
    expect(sheetAction(renderer, en.assist.decline)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.approve)?.props.onPress();
      await flush(8);
    });
    expect(hasText(renderer.root, en.assist.paymentChoiceTitle)).toBe(true);
    await act(async () => {
      await sheetAction(renderer, en.bills.payCash)?.props.onPress();
      await flush(12);
    });
    const approved = seen.find((call) => call.path === "/dispatch/mobile-shop/fix/approve");
    expect(approved).toBeDefined();
    expect(JSON.parse(approved?.body ?? "{}")).toMatchObject({ticketId: "sos9"});
  } finally {
    teardown(renderer);
  }
});

test("rider can choose SePay for a mobile fix", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos11", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "9", assignedShopId: "mobile1", finalAmount: 120000, direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Quoted");
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.approve)?.props.onPress();
      await flush(8);
    });
    await act(async () => {
      await sheetAction(renderer, en.bills.paySepay)?.props.onPress();
      await flush(12);
    });
    const created = seen.find((call) => call.path === "/payments/create");
    expect(created).toBeDefined();
    expect(JSON.parse(created?.body ?? "{}")).toMatchObject({ticketId: "sos11", method: "SEPAY"});
    expect(renderer.root.findByProps({testID: "sepay-webview"})).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

test("rider declines a mobile fix with a reason", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos10", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "9", assignedShopId: "mobile1", finalAmount: 120000, direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Quoted");
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.decline)?.props.onPress();
      await flush(8);
    });
    expect(hasText(renderer.root, en.assist.quoteDeclineTitle)).toBe(true);
    await act(async () => {
      await sheetAction(renderer, en.assist.quoteDeclinePrice)?.props.onPress();
      await flush(4);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.cancelReasonSubmit)?.props.onPress();
      await flush(12);
    });
    const declined = seen.find((call) => call.path === "/dispatch/mobile-shop/fix/decline");
    expect(declined).toBeDefined();
    expect(JSON.parse(declined?.body ?? "{}")).toMatchObject({ticketId: "sos10", reason: "PRICE_TOO_HIGH"});
  } finally {
    teardown(renderer);
  }
});

test("rider declines a walk-in quote and can see the shop again", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "walk9", userId: "u1", ticketType: "WALK_IN", lat: 10.71, lng: 106.61, status: "9", assignedShopId: "shop1", shopQuotedAmount: 150000, direction: "out", otherParty: {id: "shop1", name: "Fix Co", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · Quoted");
    expect(sheetAction(renderer, en.assist.approveQuote)).toBeDefined();
    expect(sheetAction(renderer, en.assist.decline)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.decline)?.props.onPress();
      await flush(8);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.quoteDeclineItems)?.props.onPress();
      await flush(4);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.cancelReasonSubmit)?.props.onPress();
      await flush(12);
    });
    const declined = seen.find((call) => call.path === "/dispatch/quote/decline");
    expect(declined).toBeDefined();
    expect(JSON.parse(declined?.body ?? "{}")).toMatchObject({ticketId: "walk9", reason: "ITEMS_WRONG"});
  } finally {
    teardown(renderer);
  }
});

test("tower marks a tow loaded", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE", accepting: true}];
    mockFeed = [{id: "tow3", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "3", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Arrived");
    expect(sheetAction(renderer, en.assist.loaded)).toBeDefined();
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.loaded)?.props.onPress();
      await flush(4);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.skipPhoto)?.props.onPress();
      await flush(12);
    });
    const loaded = seen.find((call) => call.path === "/dispatch/tow/loaded");
    expect(loaded).toBeDefined();
    expect(JSON.parse(loaded?.body ?? "{}")).toMatchObject({ticketId: "tow3"});
  } finally {
    teardown(renderer);
  }
});

test("tower sees the breakdown banner on a re-matched tow", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE", accepting: true}];
    mockFeed = [{id: "tow4", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "3", assignedShopId: "tow7", direction: "in", towFeeHistory: [{shopId: "tow6", amount: 50000, reasonCode: "TOWER_CANCEL_BREAKDOWN", at: "2026-01-01T00:00:00.000Z"}], otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Arrived");
    expect(hasText(renderer.root, en.assist.towerBreakdown)).toBe(true);
    expect(hasText(renderer.root, en.assist.towerBreakdownHint)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("rider cannot mark arrival or resolution on a tow", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t3", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · On the way");
    seen.length = 0;
    expect(sheetAction(renderer, en.assist.arrived)).toBeUndefined();
    expect(sheetAction(renderer, en.assist.resolved)).toBeUndefined();
    expect(seen.some((call) => call.path === "/dispatch/status")).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("records open an assigned tow with the tower arrival action", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE", accepting: false}];
    mockFeed = [{id: "t3", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · On the way");
    expect(sheetAction(renderer, en.assist.arrivedAtPickup)).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

test("dispatch push refreshes an open ticket status", async () => {
  const renderer = await mount();
  try {
    const matched = {id: "t3", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, createdAt: "2026-01-01T00:00:00.000Z"};
    mockFeed = [matched];
    mockOne = matched;
    await openRecord(renderer, "Tow · On the way");
    mockFeed = [{...matched, status: "3"}];
    mockOne = {...matched, status: "3"};
    const notifMock = jest.requireMock("expo-notifications") as {
      addNotificationReceivedListener: jest.Mock;
    };
    const received = notifMock.addNotificationReceivedListener.mock.calls
      .map((call) => call[0] as (n: unknown) => void)
      .at(-1);
    expect(received).toBeDefined();
    await act(async () => {
      received?.({request: {content: {data: {ticketId: "t3", ticketType: "TOW", status: "3"}}}});
      await flush(16);
    });
    expect(hasText(renderer.root, en.assist.statusArrived)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("tower active job shows a buttonless mini card into the modal", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t6", userId: "rider9", riderName: "Rider Nine", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    mockFeed = [{id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await expandIfCollapsed(renderer);
    await tapTab(renderer, en.assist.sectionTow);
    const row = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "Tow · Pending").pop();
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
    expect(renderer.root.findAll((n) => n.props?.name === "tow-truck").length).toBeGreaterThan(0);
    expect(hasText(renderer.root, "Rider Nine")).toBe(true);
    const mini = texts(renderer.root, "Tow · On the way").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    const miniTitles = (mini?.findAll((n) => n.props?.children === en.assist.activeJob) ?? []);
    expect(miniTitles.length).toBeGreaterThan(0);
    const cardTexts = mini?.findAll((n) => typeof n.props?.children === "string").map((n) => n.props.children as string) ?? [];
    expect(cardTexts.some((text) => text.includes(en.assist.typeTow))).toBe(false);
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

test("provider SOS feed fallback shows the active card and hides the panel", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "mobile1", kind: "MOBILE_SHOP", status: "ACTIVE", accepting: true}];
    mockFeed = [{id: "sos6", userId: "rider9", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "mobile1", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, `${en.assist.activeJob} · ${en.assist.typeSos}`)).toBe(true);
    expect(hasText(renderer.root, en.assist.expandPanel)).toBe(true);
    expect(hasText(renderer.root, en.assist.sectionRecords)).toBe(false);
  } finally {
    teardown(renderer);
  }
});

test("mobile shop SOS accept starts navigation and shows the active card", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "mobile1", kind: "MOBILE_SHOP", status: "ACTIVE", accepting: true}];
    mockNear = [{id: "sos1", userId: "rider9", riderName: "Rider Nine", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "1", note: "Flat tire"}];
    mockFeed = [{id: "sos1", userId: "rider9", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "mobile1", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockOne = {id: "sos1", userId: "rider9", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "mobile1"};
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await expandIfCollapsed(renderer);
    const row = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "SOS · Pending").pop();
    expect(row).toBeDefined();
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
    expect(hasText(renderer.root, `${en.assist.activeJob} · ${en.assist.typeSos}`)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("rider SOS shows the active card without navigation", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos2", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "3", assignedShopId: "mobile1", finalAmount: 120000, direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, `${en.assist.activeJob} · ${en.assist.typeSos}`)).toBe(true);
    expect(mockNavStart).not.toHaveBeenCalled();
  } finally {
    teardown(renderer);
  }
});

test("rider SOS draws a route from the mobile shop", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "sos2", userId: "u1", ticketType: "SOS", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "mobile1", direction: "out", otherParty: {id: "mobile1", name: "Mobile One", kind: "MOBILE_SHOP"}, mobileShopFix: {lat: 10.68, lng: 106.58, at: "2026-01-01T00:00:00.000Z"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush(12);
    });
    const route = seen.filter((call) => call.path === "/routes").pop();
    expect(route).toBeDefined();
    expect(JSON.parse(route?.body ?? "{}")).toMatchObject({
      originLat: 10.68,
      originLng: 106.58,
      destLat: 10.71,
      destLng: 106.61,
    });
    expect(renderer.root.findAll((n) => n.props?.id === "tow-job-route").length).toBeGreaterThan(0);
    expect(mockNavStart).not.toHaveBeenCalled();
  } finally {
    teardown(renderer);
  }
});

test("rider TOW draws a route from the tower fix", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t7", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", towerFix: {lat: 10.69, lng: 106.59, at: "2026-01-01T00:00:00.000Z"}, destinationSnapshot: {id: "shop-1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"}, otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush(12);
    });
    const route = seen.filter((call) => call.path === "/routes").pop();
    expect(route).toBeDefined();
    expect(JSON.parse(route?.body ?? "{}")).toMatchObject({
      originLat: 10.69,
      originLng: 106.59,
      destLat: 10.75,
      destLng: 106.65,
      stops: [{lat: 10.71, lng: 106.61}],
    });
    expect(renderer.root.findAll((n) => n.props?.id === "tow-job-route").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("active job card opens details without expanding the top panel", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    expect(hasText(renderer.root, en.assist.expandPanel)).toBe(true);
    const mini = texts(renderer.root, "Tow · On the way").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    await act(async () => {
      await mini?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.assist.expandPanel)).toBe(true);
    expect(hasText(renderer.root, en.assist.sectionRecords)).toBe(false);
    expect(sheetAction(renderer, en.assist.arrived)).toBeUndefined();
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
    const row = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "Tow · Pending").pop();
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
    const row = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "Tow · Pending").pop();
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    const labels = actionLabels(renderer);
    expect(labels).toContain(en.assist.accept);
    expect(labels).toContain(en.assist.towRoutePreview);
    expect(labels.indexOf(en.assist.towRoutePreview)).toBeLessThan(labels.indexOf(en.assist.accept));
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

test("rider cancel posts once and closes the sheet", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Pending");
    const cancel = sheetAction(renderer, en.assist.cancel);
    expect(cancel).toBeDefined();
    await act(async () => {
      await cancel?.props.onPress();
      await flush(12);
    });
    const yes = sheetAction(renderer, en.assist.confirmCancel);
    expect(yes).toBeDefined();
    await act(async () => {
      await Promise.all([yes?.props.onPress(), yes?.props.onPress()]);
      await flush(12);
    });
    expect(seen.filter((call) => call.path === "/dispatch/status")).toHaveLength(1);
    expect(sheetAction(renderer, en.assist.confirmCancel)).toBeUndefined();
    expect(hasText(renderer.root, en.assist.cancelled)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("change drop-off opens the tow picker", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Tow · Pending");
    const change = sheetAction(renderer, en.assist.changeDropOff);
    expect(change).toBeDefined();
    await act(async () => {
      await change?.props.onPress();
      await flush(12);
    });
    const input = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.route.searchDestination);
    expect(input.length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("rider's own matched tow pins a live mini card", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, destinationShopId: "shop-1", destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const mini = texts(renderer.root, "Tow · On the way").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    expect(mini?.findAll((n) => n.props?.children === "Tow Seven").length).toBeGreaterThan(0);
    await act(async () => {
      await mini?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, "Fix Shop")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("pending tow with a destination pins an info card", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "out", otherParty: null, destinationShopId: "shop-1", destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const cands = texts(renderer.root, "Tow · Pending").filter((n) => typeof n.props?.onPress === "function");
    const mini = cands.find((n) => n.findAll((m) => typeof m.props?.children === "string" && (m.props.children as string).includes(en.assist.activeJob)).length > 0);
    expect(mini).toBeDefined();
    const shopLine = (mini?.findAll((n) => typeof n.props?.children === "string" &&
      (n.props.children as string).includes("Fix Shop")) ?? []);
    expect(shopLine.length).toBeGreaterThan(0);
    expect(JSON.stringify(mini?.props.style)).not.toContain("f59e0b");
    await act(async () => {
      await mini?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, "Fix Shop")).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("destination-less pending tow pins an amber alert card into the sheet", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", direction: "out", otherParty: null, destinationShopId: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const mini = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    expect(mini?.findAll((n) => n.props?.children === en.assist.noDropOff).length).toBeGreaterThan(0);
    expect(JSON.stringify(mini?.props.style)).toContain("f59e0b");
    await act(async () => {
      await mini?.props.onPress();
      await flush(12);
    });
    expect(actionLabels(renderer)).toContain(en.assist.changeDropOff);
  } finally {
    teardown(renderer);
  }
});

test.each([["2", "On the way"], ["3", "Arrived"]])(
  "matched/arrived tow (%s) lost its drop-off goes amber",
  async (status, statusLabel) => {
    const renderer = await mount();
    try {
      mockFeed = [{
        id: "t8",
        userId: "u1",
        ticketType: "TOW",
        lat: 10.71,
        lng: 106.61,
        status,
        direction: "out",
        otherParty: {id: "tow9", name: "Tow Nine", kind: "TOW"},
        destinationShopId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }];
      const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
      await act(async () => {
        await refresh?.props.onPress();
        await flush();
      });
      const mini = texts(renderer.root, `Tow · ${statusLabel}`).find((n) => typeof n.props?.onPress === "function");
      expect(mini).toBeDefined();
      expect(JSON.stringify(mini?.props.style)).toContain("f59e0b");
      expect(mini?.findAll((n) => n.props?.children === en.assist.noDropOff).length).toBeGreaterThan(0);
      expect(mini?.findAll((n) => n.props?.children === "Tow Nine").length).toBeGreaterThan(0);
    } finally {
      teardown(renderer);
    }
  },
);

test("tower fan-out tap switches to the tow tab with a notice", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockFeed = [];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const notifMock = jest.requireMock("expo-notifications") as {
      addNotificationReceivedListener: jest.Mock;
    };
    const received = notifMock.addNotificationReceivedListener.mock.calls
      .map((call) => call[0] as (n: unknown) => void)
      .at(-1);
    expect(received).toBeDefined();
    await act(async () => {
      received?.({request: {content: {data: {ticketId: "t9", ticketType: "TOW", lat: "10.7", lng: "106.6"}}}});
      await flush(12);
    });
    expect(hasText(renderer.root, en.assist.newTowNearby)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("live job card shows no tow suffix and flips its line on arrival", async () => {
  const renderer = await mount();
  try {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({coords: {latitude: 10.7, longitude: 106.6}} as never);
    const future = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    mockFeed = [{
      id: "t8",
      userId: "u1",
      ticketType: "TOW",
      lat: 10.71,
      lng: 106.61,
      status: "3",
      direction: "out",
      otherParty: {id: "tow9", name: "Tow Nine", kind: "TOW"},
      towerFix: {lat: 10.69, lng: 106.59},
      etaDropoffAt: future,
      destinationShopId: "shop-2",
      destinationParty: {id: "shop-2", name: "Fix Two", kind: "SHOP", lat: 10.75, lng: 106.65},
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush(12);
    });
    const mini = texts(renderer.root, "Tow · Arrived").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    const titles = mini?.findAll((n) => typeof n.props?.children === "string").map((n) => n.props.children as string) ?? [];
    expect(titles.some((text) => text.includes("· Tow"))).toBe(false);
    expect(titles.some((text) => text.includes("km"))).toBe(true);
    expect(titles.some((text) => text.includes("min"))).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("live job route fetches once per geometry, not per poll", async () => {
  const renderer = await mount();
  try {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({coords: {latitude: 10.7, longitude: 106.6}} as never);
    mockFeed = [{
      id: "t8",
      userId: "u1",
      ticketType: "TOW",
      lat: 10.71,
      lng: 106.61,
      status: "2",
      direction: "out",
      otherParty: {id: "tow9", name: "Tow Nine", kind: "TOW"},
      towerFix: {lat: 10.69, lng: 106.59},
      destinationShopId: "shop-2",
      destinationParty: {id: "shop-2", name: "Fix Two", kind: "SHOP", lat: 10.75, lng: 106.65},
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush(12);
    });
    const first = seen.filter((call) => call.path === "/routes").length;
    expect(first).toBeGreaterThan(0);
    await act(async () => {
      await refresh?.props.onPress();
      await flush(12);
    });
    expect(seen.filter((call) => call.path === "/routes").length).toBe(first);
  } finally {
    teardown(renderer);
  }
});

test("live job route starts at the tower fix while matched", async () => {
  const renderer = await mount();
  try {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({coords: {latitude: 10.7, longitude: 106.6}} as never);
    mockFeed = [{
      id: "t8",
      userId: "u1",
      ticketType: "TOW",
      lat: 10.71,
      lng: 106.61,
      status: "2",
      direction: "out",
      otherParty: {id: "tow9", name: "Tow Nine", kind: "TOW"},
      towerFix: {lat: 10.69, lng: 106.59},
      destinationShopId: "shop-2",
      destinationParty: {id: "shop-2", name: "Fix Two", kind: "SHOP", lat: 10.75, lng: 106.65},
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush(12);
    });
    const routeCall = seen.find((call) => call.path === "/routes");
    expect(routeCall).toBeDefined();
    expect(JSON.parse(routeCall?.body ?? "{}")).toMatchObject({
      originLat: 10.69,
      originLng: 106.59,
      destLat: 10.75,
      destLng: 106.65,
      stops: [{lat: 10.71, lng: 106.61}],
    });
  } finally {
    teardown(renderer);
  }
});

test("inbound matched tow without a drop-off goes amber with a waiting line", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockOne = {id: "t8", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, destinationShopId: null};
    mockFeed = [{id: "t8", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, destinationShopId: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await AsyncStorage.setItem("roadassist.activeTicket", "t8");
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const mini = texts(renderer.root, "Tow · On the way").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    expect(JSON.stringify(mini?.props.style)).toContain("f59e0b");
    expect(mini?.findAll((n) => n.props?.children === en.assist.waitingDropOff).length).toBeGreaterThan(0);
    expect(mini?.findAll((n) => n.props?.children === en.assist.noDropOff).length).toBe(0);
    expect(mini?.findAll((n) => n.props?.children === "Rider Nine").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("matched tow that keeps its drop-off stays on the primary card", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{
      id: "t8",
      userId: "u1",
      ticketType: "TOW",
      lat: 10.71,
      lng: 106.61,
      status: "2",
      direction: "out",
      otherParty: {id: "tow9", name: "Tow Nine", kind: "TOW"},
      destinationShopId: "shop-2",
      destinationParty: {id: "shop-2", name: "Fix Two", kind: "SHOP", lat: 10.75, lng: 106.65},
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const mini = texts(renderer.root, "Tow · On the way").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    expect(JSON.stringify(mini?.props.style)).not.toContain("f59e0b");
    expect(mini?.findAll((n) => n.props?.children === en.assist.noDropOff).length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("a drop-off shop name alone keeps the card off amber without coordinates", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{
      id: "t8",
      userId: "u1",
      ticketType: "TOW",
      lat: 10.71,
      lng: 106.61,
      status: "2",
      direction: "out",
      otherParty: {id: "tow9", name: "Tow Nine", kind: "TOW"},
      destinationShopId: "shop-3",
      destinationParty: {id: "shop-3", name: "Fix Three", kind: "SHOP"},
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const mini = texts(renderer.root, "Tow · On the way").find((n) => typeof n.props?.onPress === "function");
    expect(mini).toBeDefined();
    expect(JSON.stringify(mini?.props.style)).not.toContain("f59e0b");
    expect(mini?.findAll((n) => n.props?.children === en.assist.noDropOff).length).toBe(0);
  } finally {
    teardown(renderer);
  }
});

test("stored working pin beats the rider fallback", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE"}];
    mockNear = [{id: "t7", userId: "rider9", riderName: "Rider Nine", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1", note: "Stuck"}];
    mockFeed = [
      {id: "t5", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", assignedShopId: "tow7", direction: "in", otherParty: {id: "rider9", name: "Rider Nine", kind: "RIDER"}, createdAt: "2026-01-01T00:00:00.000Z"},
      {id: "t6", userId: "u1", ticketType: "TOW", lat: 10.72, lng: 106.62, status: "2", direction: "out", otherParty: {id: "tow8", name: "Tow Six", kind: "TOW"}, destinationShopId: "shop-1", destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP"}, createdAt: "2026-01-02T00:00:00.000Z"},
    ];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    await expandIfCollapsed(renderer);
    await tapTab(renderer, en.assist.sectionTow);
    const row = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.accessibilityLabel === "Tow · Pending").pop();
    await act(async () => {
      await row?.props.onPress();
      await flush(12);
    });
    await act(async () => {
      await sheetAction(renderer, en.assist.accept)?.props.onPress();
      await flush(12);
    });
    const minis = texts(renderer.root, "Tow · On the way").filter((n) => typeof n.props?.onPress === "function");
    expect(minis.length).toBeGreaterThan(0);
    const card = minis.find((n) => n.findAll((m) => m.props?.children === "Rider Nine").length > 0);
    expect(card).toBeDefined();
    for (const m of minis) {
      expect(m.findAll((x) => x.props?.children === "Tow Six").length).toBe(0);
    }
  } finally {
    teardown(renderer);
  }
});

test("a stale duplicate response shows the duplicate dialog without a force action", async () => {
  const renderer = await mount();
  try {
    const sos = texts(renderer.root, en.assist.sos).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await sos?.props.onPress();
      await flush();
    });
    const prevFetch = globalThis.fetch;
    let dispatchPosts = 0;
    globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(String(url));
      if (apiPath(u) === "/dispatch" && (init?.method ?? "GET") === "POST") {
        dispatchPosts += 1;
        if (dispatchPosts <= 1) {
          seen.push({path: apiPath(u), body: String(init?.body ?? "")});
          return {ok: false, status: 409, text: async () => JSON.stringify({statusCode: 409, status: "ERROR", message: "Rider already holds a live ticket of this type", errors: {ticketId: "t7", status: "1", createdAt: "2026-01-01T00:00:00.000Z"}})} as Response;
        }
      }
      return (prevFetch as typeof fetch)(url, init);
    }) as unknown) as typeof fetch;
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush(12);
    });
    expect(hasText(renderer.root, en.assist.duplicateTitle)).toBe(true);
    expect(sheetAction(renderer, "File anyway")).toBeUndefined();
    expect(seen.filter((call) => call.path === "/dispatch")).toHaveLength(1);
  } finally {
    teardown(renderer);
  }
});

test("off-duty tower sees no accept action with the off-duty hint", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "tow7", kind: "TOW", status: "ACTIVE", accepting: false}];
    mockNear = [{id: "t6", userId: "rider9", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "1"}];
    mockFeed = [];
    const refreshOff = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refreshOff?.props.onPress();
      await flush();
    });
    await tapTab(renderer, en.assist.sectionTow);
    const offRow = texts(renderer.root, "Tow · Pending").find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await offRow?.props.onPress();
      await flush(12);
    });
    seen.length = 0;
    expect(sheetAction(renderer, en.assist.accept)).toBeUndefined();
    expect(hasText(renderer.root, en.assist.towNotAccepting)).toBe(false);
    expect(seen.find((call) => call.path === "/dispatch/accept")).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("live job collapses the top card with an expand affordance", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{id: "t6", userId: "u1", ticketType: "TOW", lat: 10.71, lng: 106.61, status: "2", direction: "out", otherParty: {id: "tow7", name: "Tow Seven", kind: "TOW"}, destinationShopId: "shop-1", destinationParty: {id: "shop-1", name: "Fix Shop", kind: "SHOP", lat: 10.75, lng: 106.65}, createdAt: "2026-01-01T00:00:00.000Z"}];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    expect(texts(renderer.root, en.assist.sectionRecords).length).toBe(0);
    const expand = texts(renderer.root, en.assist.expandPanel).find((n) => typeof n.props?.onPress === "function");
    expect(expand).toBeDefined();
    await act(async () => {
      await expand?.props.onPress();
      await flush();
    });
    expect(texts(renderer.root, en.assist.sectionRecords).length).toBeGreaterThan(0);
    expect(texts(renderer.root, en.assist.collapsePanel).find((n) => typeof n.props?.onPress === "function")).toBeDefined();
  } finally {
    teardown(renderer);
  }
});
