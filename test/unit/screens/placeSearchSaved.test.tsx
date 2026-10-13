import {expect, jest, test, beforeEach} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import {Text} from "react-native";
import PlaceSearchScreen from "../../../src/screens/PlaceSearchScreen";
import SavedPlacesSheet from "../../../src/components/place-search/SavedPlacesSheet";
import {en} from "../../../src/i18n/en";
import {clearApiCache} from "../../../src/services/cache";

const mockRefreshSaved = jest.fn();

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({status: "denied"})),
}));

jest.mock("../../../src/components/place-search", () => ({
  usePlaceSearch: () => ({
    input: "",
    options: [],
    searching: false,
    selected: null,
    handleInput: () => undefined,
    pin: () => undefined,
    select: () => undefined,
    clear: () => undefined,
    refreshSaved: mockRefreshSaved,
    resolvePoint: async () => "label",
  }),
}));

jest.mock("../../../src/services/geo", () => ({
  getFix: jest.fn(async () => ({lat: 10, lng: 106})),
}));

const mockListSaved = jest.fn(async () => [{id: "s1", label: "Home", lat: 10.5, lng: 106.5}]);
const mockRemoveSaved = jest.fn(async () => ({deleted: 1}));

jest.mock("../../../src/api/places", () => ({
  listSavedPlaces: (...args: unknown[]) => (mockListSaved as (...a: unknown[]) => Promise<unknown>)(...args),
  removeSavedPlace: (...args: unknown[]) => (mockRemoveSaved as (...a: unknown[]) => Promise<unknown>)(...args),
  savePlace: async () => ({id: "s2"}),
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function textsUnder(node: ReactTestInstance): string[] {
  return node.findAllByType(Text).map((n) => {
    const kids = n.props.children as unknown;
    return Array.isArray(kids) ? kids.join("") : String(kids ?? "");
  });
}

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function mount() {
  clearApiCache();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PlaceSearchScreen
          t={en}
          token="tok"
          lang="en"
          title={en.route.origin}
          placeholder={en.common.searchPlaceholder}
          onPick={() => undefined}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  return renderer;
}

beforeEach(() => {
  mockRefreshSaved.mockClear();
  mockListSaved.mockClear();
  mockRemoveSaved.mockClear();
});

test("bookmark button opens the saved places manager", async () => {
  const renderer = await mount();
  try {
    expect(renderer.root.findAllByType(SavedPlacesSheet)).toHaveLength(0);
    const button = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.route.savedPlaces && typeof n.props?.onPress === "function")
      .at(0);
    expect(button).toBeDefined();
    await act(async () => {
      button?.props.onPress();
      await flush();
    });
    expect(renderer.root.findAllByType(SavedPlacesSheet)).toHaveLength(1);
    expect(mockListSaved).toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});

test("no manager button without a token", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PlaceSearchScreen
          t={en}
          lang="en"
          title={en.route.origin}
          placeholder={en.common.searchPlaceholder}
          onPick={() => undefined}
          onClose={() => undefined}
        />
      </SafeAreaProvider>,
    );
    await flush();
  });
  if (!renderer) throw new Error("mount failed");
  try {
    const buttons = renderer.root.findAll(
      (n) => n.props?.accessibilityLabel === en.route.savedPlaces && typeof n.props?.onPress === "function",
    );
    expect(buttons).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});

test("deleting a saved place refreshes the results behind the dialog", async () => {
  const renderer = await mount();
  try {
    const button = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.route.savedPlaces && typeof n.props?.onPress === "function")
      .at(0);
    await act(async () => {
      button?.props.onPress();
      await flush();
    });
    const sheet = renderer.root.findAllByType(SavedPlacesSheet)[0];
    await act(async () => {
      await sheet.props.onDelete("s1");
      await flush();
    });
    expect(mockRemoveSaved).toHaveBeenCalledWith("s1", "tok");
    expect(mockRefreshSaved).toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});

test("saved list hugs its content instead of imposing a height floor", async () => {
  const renderer = await mount();
  try {
    const button = renderer.root
      .findAll((n) => n.props?.accessibilityLabel === en.route.savedPlaces && typeof n.props?.onPress === "function")
      .at(0);
    await act(async () => {
      button?.props.onPress();
      await flush();
    });
    const mins = renderer.root
      .findAll((n) => n.props?.style !== undefined)
      .map((n) => {
        const raw = n.props.style;
        const flat = (Array.isArray(raw) ? raw.flat(3) : [raw]) as {minHeight?: number}[];
        return flat.find((s) => s && typeof s.minHeight === "number")?.minHeight;
      })
      .filter((v): v is number => typeof v === "number");
    expect(mins).toEqual([]);
  } finally {
    renderer.unmount();
  }
});
