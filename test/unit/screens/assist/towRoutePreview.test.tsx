import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import TowRoutePreview from "../../../../src/screens/assist/TowRoutePreview";
import type {RouteOption} from "../../../../src/api/routes";
import {en} from "../../../../src/i18n/en";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const origin = {lat: 10.69, lng: 106.59};
const pickup = {lat: 10.71, lng: 106.61};

function route(coordinates: [number, number][]): RouteOption {
  return {source: "test", geometry: {type: "LineString", coordinates}, distanceMeters: 100, durationSeconds: 60};
}

async function renderPreview(r: RouteOption) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <TowRoutePreview t={en} summary="1.5 km" route={r} origin={origin} pickup={pickup} dest={null} busy={false} onAccept={() => undefined} onClose={() => undefined} />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function sourceById(renderer: ReturnType<typeof create>, id: string) {
  return renderer.root.findAll((n) => n.props?.id === id);
}

test("route geometry draws casing and line", async () => {
  const renderer = await renderPreview(route([[106.59, 10.69], [106.61, 10.71]]));
  try {
    expect(sourceById(renderer, "tow-preview-line-casing").length).toBeGreaterThan(0);
    expect(sourceById(renderer, "tow-preview-line").length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});

test("single-point geometry draws no line", async () => {
  const renderer = await renderPreview(route([[106.59, 10.69]]));
  try {
    expect(sourceById(renderer, "tow-preview-line-casing").length).toBe(0);
    expect(sourceById(renderer, "tow-preview-line").length).toBe(0);
    expect(sourceById(renderer, "tow-preview-origin").length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});
