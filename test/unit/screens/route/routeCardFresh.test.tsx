import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import RouteCard from "../../../../src/screens/route/RouteCard";
import {lightTheme} from "../../../../src/theme";
import {en} from "../../../../src/i18n/en";
import type {RouteOption} from "../../../../src/api/routes";
import type {MeVehicle} from "../../../../src/api/users";

const result: RouteOption = {
  source: "test",
  geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.61, 10.71]]},
  distanceMeters: 1500,
  durationSeconds: 300,
};

const vehicle: MeVehicle = {id: "v1", type: "CAR", baseWidth: 1.8, baseHeight: 1.6};

type Overrides = {
  activeVehicle?: MeVehicle | null;
  hasVehicles?: boolean;
  onOpenVehicle?: () => void;
};

async function render(overrides: Overrides = {}) {
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
        activeVehicle={overrides.activeVehicle ?? null}
        hasVehicles={overrides.hasVehicles ?? false}
        busy={false}
        starting={false}
        hazardZones={[]}
        widthBlocks={[]}
        onOpenSearch={() => undefined}
        onSwap={() => undefined}
        onDeleteStop={() => undefined}
        onOpenVehicle={overrides.onOpenVehicle ?? (() => undefined)}
        onStart={() => undefined}
        onSave={() => undefined}
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

test("card carries no freshness UI", async () => {
  const renderer = await render();
  try {
    const text = labels(renderer);
    expect(text.some((l) => l.includes("Live alerts"))).toBe(false);
    expect(text).not.toContain(en.route.alertsPaused);
  } finally {
    renderer.unmount();
  }
});

test("no-vehicle hint opens the picker and hides once a vehicle is active", async () => {
  const onOpenVehicle = jest.fn();
  const empty = await render({onOpenVehicle});
  try {
    expect(labels(empty)).toContain(en.route.vehicleHint);
    const hint = empty.root.find((n) => n.props?.accessibilityLabel === en.route.vehicleHint && typeof n.props?.onPress === "function");
    await act(async () => {
      hint.props.onPress();
    });
    expect(onOpenVehicle).toHaveBeenCalledTimes(1);
  } finally {
    empty.unmount();
  }
  const ready = await render({activeVehicle: vehicle, hasVehicles: true});
  try {
    expect(labels(ready)).not.toContain(en.route.vehicleHint);
  } finally {
    ready.unmount();
  }
});
