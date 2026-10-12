import {expect, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import AssistMapView from "../../../../src/screens/assist/AssistMapView";
import {lightTheme} from "../../../../src/theme";

const metrics: Metrics = {
  insets: {top: 0, bottom: 0, left: 0, right: 0},
  frame: {x: 0, y: 0, width: 390, height: 844},
};

const tower = {lat: 10.69, lng: 106.59};
const pickup = {lat: 10.71, lng: 106.61};
const dest = {lat: 10.75, lng: 106.65};

async function renderMap(status: string, withDest: boolean) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <AssistMapView
          theme={lightTheme}
          cameraRef={{current: null}}
          gps={null}
          dest={null}
          selectedShop={null}
          pillTextForShop={() => null}
          walkRoute={null}
          jobLayers={{tower, pickup, dest: withDest ? dest : null, status}}
          onMapReady={() => undefined}
        />
      </SafeAreaProvider>,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function sourceById(renderer: ReturnType<typeof create>, id: string) {
  return renderer.root.findAll((n) => n.props?.id === id);
}

test("tower pin uses the tower icon", async () => {
  const renderer = await renderMap("2", true);
  try {
    const towerSources = sourceById(renderer, "tow-job-tower");
    expect(towerSources.length).toBeGreaterThan(0);
    const symbols = towerSources[0]?.findAll((n) => n.props?.id === "tow-job-tower-icon") ?? [];
    expect(symbols.length).toBeGreaterThan(0);
    expect(JSON.stringify(symbols[0]?.props?.style)).toContain("tower-dot");
  } finally {
    renderer.unmount();
  }
});

test("matched leg draws tower to pickup", async () => {
  const renderer = await renderMap("2", true);
  try {
    const lines = sourceById(renderer, "tow-job-line");
    expect(lines.length).toBeGreaterThan(0);
    const geometry = lines[0]?.props?.data?.geometry;
    expect(geometry?.coordinates).toEqual([[tower.lng, tower.lat], [pickup.lng, pickup.lat]]);
  } finally {
    renderer.unmount();
  }
});

test("arrived leg draws tower to destination", async () => {
  const renderer = await renderMap("3", true);
  try {
    const lines = sourceById(renderer, "tow-job-line");
    expect(lines.length).toBeGreaterThan(0);
    const geometry = lines[0]?.props?.data?.geometry;
    expect(geometry?.coordinates).toEqual([[tower.lng, tower.lat], [dest.lng, dest.lat]]);
  } finally {
    renderer.unmount();
  }
});

test("arrived without a destination draws no connector", async () => {
  const renderer = await renderMap("3", false);
  try {
    expect(sourceById(renderer, "tow-job-line").length).toBe(0);
    expect(sourceById(renderer, "tow-job-dest").length).toBe(0);
    expect(sourceById(renderer, "tow-job-pickup").length).toBeGreaterThan(0);
  } finally {
    renderer.unmount();
  }
});
