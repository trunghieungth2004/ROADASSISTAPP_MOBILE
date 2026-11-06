import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";

import AsyncStorage from "@react-native-async-storage/async-storage";

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
    mockFeed = [{id: "t9", userId: "u1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: "4", assignedShopId: "shop9", direction: "out", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "SOS · Completed");
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
    expect(JSON.parse(rated?.body ?? "{}")).toMatchObject({targetId: "shop9", targetKind: "SHOP", ticketId: "t9", score: 5});
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
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
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
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
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

test("incoming job quote requires an amount", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "2", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    await openRecord(renderer, "Walk-in · On the way");
    const open = sheetAction(renderer, en.assist.sendQuote);
    expect(open).toBeDefined();
    await act(async () => {
      await open?.props.onPress();
      await flush();
    });
    seen.length = 0;
    const submits = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.assist.sendQuote && typeof n.props?.onPress === "function");
    await act(async () => {
      await submits.pop()?.props.onPress();
      await flush();
    });
    expect(seen.find((call) => call.path === "/dispatch/quote")).toBeUndefined();
    expect(hasText(renderer.root, en.provider.invalidAmount)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("incoming resolved job replies and rates the rider", async () => {
  const renderer = await mount();
  try {
    mockOwnProviders = [{id: "shop9", kind: "SHOP", status: "ACTIVE"}];
    mockFeed = [{id: "t2", userId: "rider2", ticketType: "WALK_IN", lat: 10.7, lng: 106.6, status: "4", providerId: "shop9", assignedShopId: "shop9", direction: "in", otherParty: null, createdAt: "2026-01-01T00:00:00.000Z"}];
    mockTicketRatings = [{id: "r1", targetId: "shop9", targetKind: "SHOP", score: 5, reply: null, repliedAt: null}];
    await openRecord(renderer, "Walk-in · Completed");
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
    const cub = rows.find((n) => n.props?.accessibilityLabel === en.vehicle.types.CAR || flatText(n).includes("Car"));
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
