import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestInstance} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import PlaceSearchScreen from "../../../src/screens/PlaceSearchScreen";
import {en} from "../../../src/i18n/en";
import type {PlaceSearch} from "../../../src/components/place-search";
import type {Place} from "../../../src/components/place-search/PlaceSearch.types";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const shop: Place = {
  label: "Fix Shop",
  lat: 10.75,
  lng: 106.65,
  source: "shop",
  id: "shop-1",
  providerKind: "SHOP",
  openNow: true,
  services: [
    {code: "BOOK", name: "Bookable service", displayPrice: 50000, quoteRequired: false, channels: ["BOOKING"]},
    {code: "ASSIST", name: "Assist service", displayPrice: 70000, quoteRequired: false, channels: ["ASSIST"]},
  ],
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

function texts(root: ReactTestInstance): string[] {
  return root.findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);
}

function pressable(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  return root.findAll((node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === "function")[0];
}

test("a shop opens the preview before selection", async () => {
  const onPick = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PlaceSearchScreen
          t={en}
          lang="en"
          title="Find a shop"
          placeholder="Search"
          onPick={onPick}
          onClose={() => undefined}
          search={stubSearch([shop])}
          shopPreviewChannel="BOOKING"
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  const view = renderer;
  try {
    await act(async () => {
      pressable(view.root, "Fix Shop")?.props.onPress();
    });
    expect(onPick).not.toHaveBeenCalled();
    expect(texts(view.root)).toContain("Bookable service");
    expect(texts(view.root)).not.toContain("Assist service");
    await act(async () => {
      pressable(view.root, en.shop.useShop)?.props.onPress();
    });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(shop);
  } finally {
    renderer.unmount();
  }
});

test("closing the preview leaves the shop unselected", async () => {
  const onPick = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PlaceSearchScreen
          t={en}
          lang="en"
          title="Find a shop"
          placeholder="Search"
          onPick={onPick}
          onClose={() => undefined}
          search={stubSearch([shop])}
          shopPreviewChannel="BOOKING"
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  const view = renderer;
  try {
    await act(async () => {
      pressable(view.root, "Fix Shop")?.props.onPress();
    });
    await act(async () => {
      pressable(view.root, en.common.cancel)?.props.onPress();
    });
    expect(onPick).not.toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});
