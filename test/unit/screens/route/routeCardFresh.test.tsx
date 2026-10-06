import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import RouteCard from "../../../../src/screens/route/RouteCard";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";
import type {RouteOption} from "../../../../src/api/routes";

const result: RouteOption = {
  source: "test",
  geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]},
  distanceMeters: 1500,
  durationSeconds: 300,
};

async function render(checkedAt: number | null, nowMs: number) {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <RouteCard
        t={en}
        theme={lightTheme}
        lang="en"
        originText="A"
        destText="B"
        stops={[]}
        result={result}
        origin={{lat: 10.7, lng: 106.6}}
        dest={{lat: 10.71, lng: 106.61}}
        activeVehicle={null}
        hasVehicles={false}
        busy={false}
        starting={false}
        hazardZones={[]}
        widthBlocks={[]}
        checkedAt={checkedAt}
        nowMs={nowMs}
        checking={false}
        onOpenSearch={() => undefined}
        onSwap={() => undefined}
        onDeleteStop={() => undefined}
        onOpenVehicle={() => undefined}
        onStart={() => undefined}
        onSave={() => undefined}
        onRefreshAlerts={() => undefined}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

function labels(renderer: ReturnType<typeof create>): string[] {
  return renderer.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string);
}

test("fresh route shows live alerts with age", async () => {
  const renderer = await render(60000, 120000);
  try {
    const text = labels(renderer);
    expect(text.some((l) => l.includes(en.route.liveAlerts))).toBe(true);
    expect(text).not.toContain(en.route.alertsPaused);
  } finally {
    renderer.unmount();
  }
});

test("stale route shows the paused prompt and refreshes on tap", async () => {
  const onRefreshAlerts = jest.fn();
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <RouteCard
        t={en}
        theme={lightTheme}
        lang="en"
        originText="A"
        destText="B"
        stops={[]}
        result={result}
        origin={{lat: 10.7, lng: 106.6}}
        dest={{lat: 10.71, lng: 106.61}}
        activeVehicle={null}
        hasVehicles={false}
        busy={false}
        starting={false}
        hazardZones={[]}
        widthBlocks={[]}
        checkedAt={null}
        nowMs={120000}
        checking={false}
        onOpenSearch={() => undefined}
        onSwap={() => undefined}
        onDeleteStop={() => undefined}
        onOpenVehicle={() => undefined}
        onStart={() => undefined}
        onSave={() => undefined}
        onRefreshAlerts={onRefreshAlerts}
      />,
    );
  });
  if (!renderer) throw new Error("render failed");
  try {
    expect(labels(renderer)).toContain(en.route.alertsPaused);
    const chip = renderer.root.findAll((n) => n.props?.accessibilityLabel === en.route.alertsPaused).find((n) => typeof n.props?.onPress === "function");
    expect(chip).toBeDefined();
    await act(async () => {
      await chip?.props.onPress();
    });
    expect(onRefreshAlerts).toHaveBeenCalledTimes(1);
  } finally {
    renderer.unmount();
  }
});
