import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import NavigationScreen from "../../../src/screens/NavigationScreen";
import {clearApiCache} from "../../../src/services/cache";
import {en} from "../../../src/i18n/en";
import type {RouteOption} from "../../../src/api/routes";

jest.mock("../../../src/context/AuthContext", () => ({
  useAuth: () => ({token: "tok", uid: "u1", loaded: true}),
}));

jest.mock("../../../src/context/LanguageContext", () => {
  const {en: mockedEn} = require("../../../src/i18n/en");
  return {
    useStrings: () => ({t: mockedEn, lang: "en" as const, toggle: () => undefined}),
  };
});

const mockRoute = {
  source: "test",
  geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]},
  distanceMeters: 1500,
  durationSeconds: 300,
} as RouteOption;

const mockClear = jest.fn();
const mockGoBack = jest.fn();
const mockSetCheckedIn = jest.fn();
const mockSetNavEnded = jest.fn();
const mockPatch = jest.fn();
const mockRetarget = jest.fn(async (..._args: unknown[]) => ({changed: true, warnings: []}));
let mockCheckIn: {providerId: string; name: string} | undefined = {providerId: "s1", name: "Good Shop"};
let mockTicketId: string | undefined = "t1";

jest.mock("../../../src/context/NavSessionContext", () => {
  const actual = jest.requireActual("../../../src/context/NavSessionContext") as typeof import("../../../src/context/NavSessionContext");
  return {
    ...actual,
    useNavSession: () => ({
      session: {
        route: mockRoute,
        dest: {lat: 10.71, lng: 106.61},
        seed: {lat: 10.7, lng: 106.6},
        stops: [],
        ...(mockCheckIn ? {checkIn: mockCheckIn} : {}),
        ...(mockTicketId ? {ticketId: mockTicketId} : {}),
      },
      start: () => undefined,
      patch: mockPatch,
      clear: mockClear,
      checkedIn: false,
      setCheckedIn: mockSetCheckedIn,
      navEnded: false,
      setNavEnded: mockSetNavEnded,
    }),
  };
});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({goBack: mockGoBack, setOptions: jest.fn()}),
  useIsFocused: () => true,
}));

jest.mock("expo-speech", () => ({
  stop: jest.fn(),
  speak: jest.fn(() => undefined),
  getAvailableVoicesAsync: jest.fn(async () => []),
  VoiceQuality: {Enhanced: "enhanced"},
}));

const mockNavState = {
  arrived: true,
  pos: {lat: 10.71, lng: 106.61} as {lat: number; lng: number} | null,
};

jest.mock("../../../src/screens/navigation/useNavTracking", () => ({
  useNavTracking: () => ({
    route: mockRoute,
    pos: mockNavState.pos,
    arrowRotate: 0,
    cameraRef: {current: null},
    traveled: [],
    remaining: [],
    preview: null,
    hazardFocus: null,
    next: null,
    arrived: mockNavState.arrived,
    rerouting: false,
    following: true,
    recentering: false,
    onRecenter: () => undefined,
    hazardCount: 0,
    cycleHazard: () => undefined,
    focusAt: () => undefined,
    flagWarnings: [],
    onRegionChanging: () => undefined,
    progress: {remainingMeters: 0, progressMeters: 1500},
    speedKmh: null,
    error: null,
    notice: null,
    clearError: () => undefined,
    refreshRouteQuiet: () => undefined,
    retargetTo: (next: unknown, stops: unknown) => mockRetarget(next, stops),
  }),
}));

let mockPushHandler: ((data: {ticketId: string}) => void) | null = null;

jest.mock("../../../src/services/push", () => {
  const actual = jest.requireActual("../../../src/services/push") as typeof import("../../../src/services/push");
  return {
    ...actual,
    subscribeDispatchPush: (fn: (data: {ticketId: string}) => void) => {
      mockPushHandler = fn;
      return () => undefined;
    },
  };
});

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const realFetch = globalThis.fetch;
const seen: {path: string; body: string}[] = [];
let mockOneTicket: unknown = {id: "t1", status: "2"};

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
    if (u.pathname === "/dispatch/one") return envelope(mockOneTicket);
    return envelope({id: "t1"});
  }) as unknown) as typeof fetch;
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function render() {
  mockClear.mockClear();
  mockGoBack.mockClear();
  mockSetCheckedIn.mockClear();
  mockSetNavEnded.mockClear();
  mockPatch.mockClear();
  mockRetarget.mockClear();
  mockPushHandler = null;
  clearApiCache();
  installFetch();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <NavigationScreen />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

function teardown(renderer: ReturnType<typeof create>): void {
  renderer.unmount();
  globalThis.fetch = realFetch;
  clearApiCache();
}

function checkInButton(renderer: ReturnType<typeof create>) {
  return renderer.root
    .findAll((n) => n.props?.accessibilityLabel === en.assist.imHere && typeof n.props?.onPress === "function")
    .pop();
}

test("arrival at a shop destination offers check-in", async () => {
  mockNavState.arrived = true;
  mockNavState.pos = {lat: 10.71, lng: 106.61};
  mockCheckIn = {providerId: "s1", name: "Good Shop"};
  const renderer = await render();
  try {
    expect(checkInButton(renderer)).toBeDefined();
    expect(renderer.root.findAll((n) => n.props?.children === "Good Shop").length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("check-in card sits above the progress bar", async () => {
  mockNavState.arrived = true;
  mockNavState.pos = {lat: 10.71, lng: 106.61};
  mockCheckIn = {providerId: "s1", name: "Good Shop"};
  const renderer = await render();
  try {
    const ordered = renderer.root.findAll((n) =>
      (n.props?.accessibilityLabel === en.assist.imHere && typeof n.props?.onPress === "function") ||
      (typeof n.props?.children === "string" && /^\d+(\.\d+)? (m|km)$/.test(n.props.children as string)),
    );
    expect(ordered.length).toBeGreaterThan(1);
    expect(ordered[0]?.props?.accessibilityLabel).toBe(en.assist.imHere);
  } finally {
    teardown(renderer);
  }
});

test("arrival check-in files the walk-in ticket and exits to Assist", async () => {
  mockNavState.arrived = true;
  mockNavState.pos = {lat: 10.71, lng: 106.61};
  mockCheckIn = {providerId: "s1", name: "Good Shop"};
  const renderer = await render();
  try {
    seen.length = 0;
    await act(async () => {
      await checkInButton(renderer)?.props.onPress();
      await flush(12);
    });
    const posted = seen.find((call) => call.path === "/dispatch");
    expect(posted).toBeDefined();
    expect(JSON.parse(posted?.body ?? "{}")).toMatchObject({ticketType: "WALK_IN", providerId: "s1"});
    expect(mockSetCheckedIn).toHaveBeenCalledWith(true);
    expect(mockClear).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  } finally {
    teardown(renderer);
  }
});

test("no check-in card before arrival", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockCheckIn = {providerId: "s1", name: "Good Shop"};
  const renderer = await render();
  try {
    expect(checkInButton(renderer)).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("no check-in card when far from the shop", async () => {
  mockNavState.arrived = true;
  mockNavState.pos = {lat: 10.9, lng: 106.9};
  mockCheckIn = {providerId: "s1", name: "Good Shop"};
  const renderer = await render();
  try {
    expect(checkInButton(renderer)).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("no check-in card without a shop destination", async () => {
  mockNavState.arrived = true;
  mockNavState.pos = {lat: 10.71, lng: 106.61};
  mockCheckIn = undefined;
  const renderer = await render();
  try {
    expect(checkInButton(renderer)).toBeUndefined();
  } finally {
    teardown(renderer);
    mockCheckIn = {providerId: "s1", name: "Good Shop"};
  }
});

test("destination push retargets the navigator to the new drop-off", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockTicketId = "t1";
  mockOneTicket = {
    id: "t1",
    status: "2",
    lat: 10.705,
    lng: 106.605,
    destinationSnapshot: {id: "shop-2", name: "New Shop", lat: 10.78, lng: 106.68, kind: "SHOP"},
  };
  const renderer = await render();
  try {
    expect(mockPushHandler).not.toBeNull();
    await act(async () => {
      await mockPushHandler?.({ticketId: "t1"});
      await flush(12);
    });
    expect(mockPatch).toHaveBeenCalledWith({
      dest: {lat: 10.78, lng: 106.68},
      stops: [{lat: 10.705, lng: 106.605}],
    });
    expect(mockRetarget).toHaveBeenCalledWith(
      {lat: 10.78, lng: 106.68},
      [{lat: 10.705, lng: 106.605}],
    );
    expect(renderer.root.findAll((n) => n.props?.children === en.nav.dropOffUpdated).length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("cleared destination holds guidance with a notice", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockTicketId = "t1";
  mockOneTicket = {id: "t1", status: "2", lat: 10.705, lng: 106.605};
  const renderer = await render();
  try {
    await act(async () => {
      await mockPushHandler?.({ticketId: "t1"});
      await flush(12);
    });
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockRetarget).not.toHaveBeenCalled();
    expect(renderer.root.findAll((n) => n.props?.children === en.nav.dropOffRemoved).length).toBeGreaterThan(0);
  } finally {
    teardown(renderer);
  }
});

test("cancelled ticket exits navigation with a notice flag", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockTicketId = "t1";
  mockOneTicket = {id: "t1", status: "5", lat: 10.705, lng: 106.605};
  const renderer = await render();
  try {
    await act(async () => {
      await mockPushHandler?.({ticketId: "t1"});
      await flush(12);
    });
    expect(mockSetNavEnded).toHaveBeenCalledWith(true);
    expect(mockClear).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  } finally {
    teardown(renderer);
  }
});

test("pushes for other tickets are ignored", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockTicketId = "t1";
  mockOneTicket = {id: "t9", status: "2", lat: 10.7, lng: 106.6};
  const renderer = await render();
  try {
    await act(async () => {
      await mockPushHandler?.({ticketId: "t9"});
      await flush(12);
    });
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockSetNavEnded).not.toHaveBeenCalled();
    expect(seen.find((call) => call.path === "/dispatch/one")).toBeUndefined();
  } finally {
    teardown(renderer);
  }
});

test("tow job navigation shares live location", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockTicketId = "t1";
  const renderer = await render();
  try {
    await act(async () => {
      await flush(12);
    });
    expect(seen.find((call) => call.path === "/providers/location")).toBeDefined();
  } finally {
    teardown(renderer);
  }
});

test("non-job navigation stays silent on location", async () => {
  mockNavState.arrived = false;
  mockNavState.pos = {lat: 10.705, lng: 106.605};
  mockTicketId = undefined;
  const renderer = await render();
  try {
    await act(async () => {
      await flush(12);
    });
    expect(seen.find((call) => call.path === "/providers/location")).toBeUndefined();
  } finally {
    teardown(renderer);
    mockTicketId = "t1";
  }
});
