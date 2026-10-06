import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import RouteMapView from "../../../../src/screens/route/RouteMapView";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";
import type {RouteOption} from "../../../../src/api/routes";

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

function option(distanceMeters: number, durationSeconds: number): RouteOption {
  return {
    source: "test",
    geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]},
    distanceMeters,
    durationSeconds,
    hazards: [],
  };
}

type Props = React.ComponentProps<typeof RouteMapView>;

function baseProps(routes: RouteOption[], onSelectIndex: (i: number) => void, overrides?: Partial<Props>): Props {
  return {
    t: en,
    theme: lightTheme,
    cameraRef: {current: null},
    routes,
    selectedIndex: 0,
    result: routes[0] ?? null,
    origin: null,
    dest: null,
    gps: null,
    flagPoint: null,
    stops: [],
    dragPos: null,
    selectedMid: routes[0] ? [106.605, 10.705] : null,
    hazardHighlight: null,
    dragging: null,
    dragPan: {panHandlers: {}} as Props["dragPan"],
    pickingFor: null,
    pickBusy: false,
    onMapPress: () => undefined,
    onRegionChange: () => undefined,
    onRegionDid: () => undefined,
    onSelectIndex,
    onCancelPick: () => undefined,
    onMapReady: () => undefined,
    flagCamRef: {current: null},
    flagsToken: null,
    flagsKey: 0,
    onPickFlag: () => undefined,
    subscribeRegionDid: () => () => undefined,
    ...overrides,
  };
}

async function render(routes: RouteOption[], onSelectIndex: (i: number) => void, overrides?: Partial<Props>) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <RouteMapView {...baseProps(routes, onSelectIndex, overrides)} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function textOf(node: {props?: {children?: unknown}}): string | null {
  const c = node.props?.children;
  if (typeof c === "string") return c;
  if (typeof c === "number") return String(c);
  if (Array.isArray(c) && c.every((p) => typeof p === "string" || typeof p === "number")) return c.join("");
  return null;
}

function labels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => textOf(n) !== null)
    .map((n) => textOf(n) as string);
}

test("single route renders its distance and time pill", async () => {
  const renderer = await render([option(2400, 2280)], () => undefined);
  try {
    const expected = `1 · ${(2400 / 1000).toFixed(1)} ${en.route.km} · ${Math.round(2280 / 60)} ${en.route.min}`;
    expect(labels(renderer)).toContain(expected);
  } finally {
    renderer.unmount();
  }
});

test("single pill taps index zero", async () => {
  const onSelectIndex = jest.fn();
  const renderer = await render([option(2400, 2280)], onSelectIndex);
  try {
    const pill = renderer.root.findAll((n) => typeof n.props?.onPress === "function" && typeof n.props?.onLayout === "function").find((n) => {
      try {
        const text = n.findAll((c) => textOf(c) !== null).map((c) => textOf(c) as string).join("");
        return text.includes(en.route.km);
      } catch {
        return false;
      }
    });
    expect(pill).toBeDefined();
    await act(async () => {
      await pill?.props.onPress();
    });
    expect(onSelectIndex).toHaveBeenCalledWith(0);
  } finally {
    renderer.unmount();
  }
});

test("no routes renders no pill", async () => {
  const renderer = await render([], () => undefined);
  try {
    expect(labels(renderer).some((l) => l.includes(en.route.km))).toBe(false);
  } finally {
    renderer.unmount();
  }
});

test("mid-route pill shows the selected distance and time", async () => {
  const renderer = await render([option(2400, 2280)], () => undefined);
  try {
    const expected = `${(2400 / 1000).toFixed(1)} ${en.route.km} · ${Math.round(2280 / 60)} ${en.route.min}`;
    expect(labels(renderer)).toContain(expected);
  } finally {
    renderer.unmount();
  }
});

test("mid-route pill hides without a result", async () => {
  const renderer = await render([option(2400, 2280)], () => undefined, {result: null});
  try {
    const expected = `${(2400 / 1000).toFixed(1)} ${en.route.km} · ${Math.round(2280 / 60)} ${en.route.min}`;
    expect(labels(renderer)).not.toContain(expected);
  } finally {
    renderer.unmount();
  }
});

test("mid-route pill hides while dragging", async () => {
  const renderer = await render([option(2400, 2280)], () => undefined, {dragging: "origin"});
  try {
    const expected = `${(2400 / 1000).toFixed(1)} ${en.route.km} · ${Math.round(2280 / 60)} ${en.route.min}`;
    expect(labels(renderer)).not.toContain(expected);
  } finally {
    renderer.unmount();
  }
});

test("mid-route pill hides while picking a point", async () => {
  const renderer = await render([option(2400, 2280)], () => undefined, {pickingFor: "origin"});
  try {
    const expected = `${(2400 / 1000).toFixed(1)} ${en.route.km} · ${Math.round(2280 / 60)} ${en.route.min}`;
    expect(labels(renderer)).not.toContain(expected);
  } finally {
    renderer.unmount();
  }
});
