import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import PlaceSearchScreen from "../../../src/screens/PlaceSearchScreen";
import {en} from "../../../src/i18n/en";
import type {PlaceSearch} from "../../../src/components/place-search";
import type {Place} from "../../../src/components/place-search/PlaceSearch.types";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function stubSearch(options: Place[]): PlaceSearch {
  return {
    input: "",
    options,
    searching: false,
    selected: null,
    handleInput: () => undefined,
    pin: () => undefined,
    select: jest.fn(),
    clear: () => undefined,
    refreshSaved: () => undefined,
    resolvePoint: async () => "",
  };
}

const shops: Place[] = [
  {label: "Fix Shop", lat: 10.75, lng: 106.65, source: "shop", id: "shop-1"},
  {label: "Other Shop", lat: 10.76, lng: 106.66, source: "shop", id: "shop-2"},
];

async function renderScreen(disabledIds?: Set<string>) {
  const onPick = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PlaceSearchScreen
          t={en}
          lang="en"
          title="Drop-off"
          placeholder="Search"
          onPick={onPick}
          onClose={() => undefined}
          search={stubSearch(shops)}
          disabledIds={disabledIds}
          disabledNote={en.assist.shopDeclined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return {renderer, onPick};
}

test("declined shops render disabled with a note", async () => {
  const {renderer, onPick} = await renderScreen(new Set(["shop-1"]));
  try {
    const rows = renderer.root.findAll((n) => typeof n.props?.accessibilityLabel === "string" && typeof n.props?.onPress === "function");
    const declined = rows.find((n) => n.props.accessibilityLabel === "Fix Shop");
    const open = rows.find((n) => n.props.accessibilityLabel === "Other Shop");
    expect(declined?.props.disabled).toBe(true);
    expect(open?.props.disabled).toBeFalsy();
    const notes = renderer.root.findAll((n) => n.props?.children === en.assist.shopDeclined);
    expect(notes.length).toBeGreaterThan(0);
    await act(async () => {
      await open?.props.onPress();
    });
    expect(onPick).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});

test("rows stay enabled without declined ids", async () => {
  const {renderer} = await renderScreen();
  try {
    const rows = renderer.root.findAll((n) => typeof n.props?.accessibilityLabel === "string" && typeof n.props?.onPress === "function");
    for (const row of rows.filter((n) => ["Fix Shop", "Other Shop"].includes(n.props.accessibilityLabel as string))) {
      expect(row.props.disabled).toBeFalsy();
    }
    expect(renderer.root.findAll((n) => n.props?.children === en.assist.shopDeclined).length).toBe(0);
  } finally {
    renderer.unmount();
  }
});
