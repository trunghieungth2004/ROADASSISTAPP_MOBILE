import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {ActivityIndicator} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import AssistScreen from "../../../../src/screens/AssistScreen";
import {clearApiCache} from "../../../../src/services/cache";
import {clearGeocodeCache} from "../../../../src/api/places";
import {uploadPhotoPaths} from "../../../../src/services/photos";
import {en} from "../../../../src/i18n/en";
import {lightTheme} from "../../../../src/theme";

jest.mock("../../../../src/services/photos", () => {
  const actual = jest.requireActual("../../../../src/services/photos") as Record<string, unknown>;
  return {
    ...actual,
    takePhoto: jest.fn(async () => ["file:///sos.jpg"]),
    uploadPhotoPaths: jest.fn(),
  };
});

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

test("a second SOS on another vehicle is blocked", async () => {
  const renderer = await mount();
  try {
    mockFeed = [{
      id: "sos-old",
      userId: "u1",
      ticketType: "SOS",
      lat: 10.7,
      lng: 106.6,
      status: "1",
      vehicleId: "v2",
      direction: "out",
      otherParty: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    const refresh = texts(renderer.root, en.assist.refresh).find((n) => typeof n.props?.onPress === "function");
    await act(async () => {
      await refresh?.props.onPress();
      await flush();
    });
    const sos = texts(renderer.root, en.assist.sos).find((n) => typeof n.props?.onPress === "function");
    expect(sos).toBeDefined();
    await act(async () => {
      await sos?.props.onPress();
      await flush();
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush(8);
    });
    expect(seen.some((call) => call.path === "/dispatch")).toBe(false);
    expect(hasText(renderer.root, en.assist.sosBusyTitle)).toBe(true);
    expect(hasText(renderer.root, en.assist.sosBusyMessage)).toBe(true);
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

test("a request without an active vehicle opens the vehicle picker", async () => {
  const renderer = await mountWithVehicle(null);
  try {
    const sos = texts(renderer.root, en.assist.sos).find((n) => typeof n.props?.onPress === "function");
    expect(sos).toBeDefined();
    await act(async () => {
      await sos?.props.onPress();
      await flush();
    });
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush(8);
    });
    expect(seen.some((call) => call.path === "/dispatch")).toBe(false);
    expect(hasText(renderer.root, en.assist.vehicleRequired)).toBe(true);
    expect(hasText(renderer.root, en.vehicle.title)).toBe(true);
  } finally {
    teardown(renderer);
  }
});

test("a failed photo upload blocks the SOS until the rider retries or sends without photos", async () => {
  const renderer = await mount();
  try {
    const sos = texts(renderer.root, en.assist.sos).find((n) => typeof n.props?.onPress === "function");
    expect(sos).toBeDefined();
    await act(async () => {
      await sos?.props.onPress();
      await flush();
    });
    const add = renderer.root.find((n) => n.props?.accessibilityLabel === en.photos.take && typeof n.props?.onPress === "function");
    await act(async () => {
      await add.props.onPress();
      await flush();
    });
    jest.mocked(uploadPhotoPaths).mockRejectedValue(new Error("upload failed"));
    seen.length = 0;
    await act(async () => {
      await sheetAction(renderer, en.assist.request)?.props.onPress();
      await flush(8);
    });
    expect(seen.some((call) => call.path === "/dispatch")).toBe(false);
    expect(hasText(renderer.root, en.photos.uploadFailed)).toBe(true);
    expect(sheetAction(renderer, en.common.retry)).toBeDefined();
    expect(sheetAction(renderer, en.photos.sendWithout)).toBeDefined();
    await act(async () => {
      await sheetAction(renderer, en.photos.sendWithout)?.props.onPress();
      await flush(8);
    });
    const posted = seen.find((call) => call.path === "/dispatch");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).not.toHaveProperty("photoUrls");
    expect(hasText(renderer.root, en.assist.requested)).toBe(true);
  } finally {
    teardown(renderer);
  }
});
