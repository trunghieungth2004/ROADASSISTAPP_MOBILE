import {expect, jest, test} from "@jest/globals";
import {act, create, type ReactTestRenderer} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import MapPickOverlay from "../../../src/components/map/MapPickOverlay";
import ShopHoursEditor from "../../../src/components/providers/ShopHoursEditor";
import PlaceSearchScreen from "../../../src/screens/PlaceSearchScreen";
import {emptyWeek} from "../../../src/screens/more/shopHours";
import {clearGeocodeCache} from "../../../src/api/places";
import {en} from "../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function mount(element: React.ReactElement): ReactTestRenderer {
  let rendered: ReactTestRenderer | undefined;
  act(() => {
    rendered = create(<SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>);
  });
  if (!rendered) throw new Error("mount failed");
  return rendered;
}

const realFetch = globalThis.fetch;

function jsonResponse(body: unknown, ok = true): Response {
  return {ok, json: async () => body} as Response;
}

test("map confirm reverse-geocodes the center and picks it", async () => {
  await clearGeocodeCache();
  globalThis.fetch = (jest.fn(async () => jsonResponse({features: [{place_name: "Mock Street 1"}]})) as unknown) as typeof fetch;
  try {
    let picked: {lat: number; lng: number; label: string} | null = null;
    const rendered = mount(
      <MapPickOverlay t={en} lang="en" title="Pick" initial={{lat: 10.75, lng: 106.65}} onPick={(lat, lng, label) => { picked = {lat, lng, label}; }} onClose={() => undefined} />,
    );
    const confirm = rendered.root.findAll(
      (n) => n.props?.accessibilityLabel === en.provider.useThisLocation && typeof n.props?.onPress === "function",
    );
    expect(confirm.length).toBeGreaterThan(0);
    await act(async () => {
      await confirm[0].props.onPress();
    });
    expect(picked).toEqual({lat: 10.75, lng: 106.65, label: "Mock Street 1"});
    rendered.unmount();
  } finally {
    globalThis.fetch = realFetch;
  }
});

function pickOnMapLabels(rendered: ReactTestRenderer): number {
  return rendered.root.findAll((n) => n.props?.children === en.route.pickOnMap).length;
}

test("hours editor marks enabled days with a check and disabled days as closed", () => {
  const week = emptyWeek();
  week.MON = {enabled: true, open: "08:00", close: "18:00"};
  const rendered = mount(<ShopHoursEditor t={en} week={week} setDay={() => undefined} />);
  const checks = rendered.root.findAll((n) => n.props?.name === "check");
  expect(checks.length).toBeGreaterThan(0);
  const closed = rendered.root.findAll((n) => n.props?.children === en.provider.closed);
  expect(closed.length).toBeGreaterThan(0);
  rendered.unmount();
});

test("place search shows the map button only when onPickOnMap is passed", () => {
  const withMap = mount(
    <PlaceSearchScreen t={en} lang="en" title="Pick" placeholder="Search" onPick={() => undefined} onPickOnMap={() => undefined} onClose={() => undefined} />,
  );
  expect(pickOnMapLabels(withMap)).toBeGreaterThan(0);
  withMap.unmount();
  const withoutMap = mount(
    <PlaceSearchScreen t={en} lang="en" title="Pick" placeholder="Search" onPick={() => undefined} onClose={() => undefined} />,
  );
  expect(pickOnMapLabels(withoutMap)).toBe(0);
  withoutMap.unmount();
});

function nearbyLabels(rendered: ReactTestRenderer): number {
  return rendered.root.findAll((n) => n.props?.children === en.shop.nearbyShops).length;
}

test("place search shows the nearby button only when onBrowseNearby is passed", () => {
  const onBrowseNearby = jest.fn();
  const withNearby = mount(
    <PlaceSearchScreen t={en} lang="en" title="Pick" placeholder="Search" onPick={() => undefined} onBrowseNearby={onBrowseNearby} onClose={() => undefined} />,
  );
  try {
    expect(nearbyLabels(withNearby)).toBeGreaterThan(0);
    const btn = withNearby.root
      .findAll((n) => typeof n.props?.onPress === "function" && flatText(n.props?.children).includes(en.shop.nearbyShops))
      .pop();
    expect(btn).toBeDefined();
    act(() => {
      btn?.props.onPress();
    });
    expect(onBrowseNearby).toHaveBeenCalledTimes(1);
  } finally {
    withNearby.unmount();
  }
  const withoutNearby = mount(
    <PlaceSearchScreen t={en} lang="en" title="Pick" placeholder="Search" onPick={() => undefined} onClose={() => undefined} />,
  );
  try {
    expect(nearbyLabels(withoutNearby)).toBe(0);
  } finally {
    withoutNearby.unmount();
  }
});

function flatText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join(" ");
  if (node && typeof node === "object") return flatText((node as {props?: {children?: unknown}}).props?.children);
  return "";
}
