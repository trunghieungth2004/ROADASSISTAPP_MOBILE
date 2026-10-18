import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import PlaceSearchScreen from "../../../src/screens/PlaceSearchScreen";
import {en} from "../../../src/i18n/en";
import type {ShopSearchFilters} from "../../../src/components/place-search/PlaceSearch.types";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

type ScreenProps = React.ComponentProps<typeof PlaceSearchScreen>;

async function render(overrides?: Partial<ScreenProps>) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PlaceSearchScreen t={en} lang="en" title="Drop-off" placeholder="Search" onPick={() => undefined} onClose={() => undefined} {...overrides} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function tap(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function").pop();
}

test("filter chips re-run the shop search with the chosen sort and rating", async () => {
  jest.useFakeTimers();
  const shops = jest.fn(async (_q: string, _f?: ShopSearchFilters) => [{id: "s1", name: "Good Shop", lat: 10.71, lng: 106.61}]);
  const renderer = await render({shops, filters: {sortBy: "distance"}, sources: ["shop"]});
  try {
    const input = renderer.root.findAll((n) => n.props?.accessibilityLabel === "Search" && typeof n.props?.onChangeText === "function")[0];
    act(() => {
      input?.props.onChangeText("sua xe");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(shops).toHaveBeenCalledTimes(1);
    expect(shops.mock.calls[0][1]).toMatchObject({sortBy: "distance"});
    await act(async () => {
      tap(renderer, en.shop.sortRating)?.props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(shops).toHaveBeenCalledTimes(2);
    expect(shops.mock.calls[1][1]).toMatchObject({sortBy: "rating"});
    await act(async () => {
      tap(renderer, en.shop.ratingMin.replace("{n}", "4.0"))?.props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(shops).toHaveBeenLastCalledWith("sua xe", expect.objectContaining({sortBy: "rating", minRating: 4}));
  } finally {
    renderer.unmount();
    jest.useRealTimers();
  }
});

test("the chips stay hidden without shop filters", async () => {
  const shops = jest.fn(async () => [{id: "s1", name: "Good Shop", lat: 10.71, lng: 106.61}]);
  const renderer = await render({shops, sources: ["shop"]});
  try {
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.shop.sortRating && typeof n.props?.onPress === "function")).toHaveLength(0);
    expect(renderer.root.findAll((n) => n.props?.accessibilityLabel === en.shop.ratingAny && typeof n.props?.onPress === "function")).toHaveLength(0);
  } finally {
    renderer.unmount();
  }
});
