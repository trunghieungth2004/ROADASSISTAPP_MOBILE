import {expect, test} from "@jest/globals";
import type {ReactElement} from "react";
import {act, create} from "react-test-renderer";
import {lightTheme} from "../../../src/theme";
import {VehicleClassIcons, VehicleClassGlyph, VehicleGlyph} from "../../../src/components/vehicles/VehicleIcons";
import ServiceCategoryIcon from "../../../src/components/providers/ServiceCategoryIcon";

async function iconNames(element: ReactElement): Promise<string[]> {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(element);
  });
  if (!renderer) throw new Error("render failed");
  const names = renderer.root
    .findAll((node) => typeof node.props?.name === "string")
    .map((node) => node.props.name as string)
    .filter((value, index, all) => all.indexOf(value) === index);
  await act(async () => {
    renderer?.unmount();
  });
  return names;
}

test("vehicle glyphs follow the vehicle class", async () => {
  expect(await iconNames(<VehicleGlyph type="CAR" color={lightTheme.primary} />)).toEqual(["car"]);
  expect(await iconNames(<VehicleGlyph type="BIKE" color={lightTheme.primary} />)).toEqual(["motorbike"]);
  expect(await iconNames(<VehicleClassGlyph vehicleClass="CAR" color={lightTheme.primary} />)).toEqual(["car"]);
  expect(await iconNames(<VehicleClassGlyph vehicleClass="SOLO_BIKE" color={lightTheme.primary} />)).toEqual(["motorbike"]);
});

test("class icon pairs cover both, bike-only and car-only shops", async () => {
  expect(await iconNames(<VehicleClassIcons classes={[]} color={lightTheme.primary} label="both" />)).toEqual(["motorbike", "car"]);
  expect(await iconNames(<VehicleClassIcons classes={["SOLO_BIKE"]} color={lightTheme.primary} label="bike" />)).toEqual(["motorbike"]);
  expect(await iconNames(<VehicleClassIcons classes={["CAR"]} color={lightTheme.primary} label="car" />)).toEqual(["car"]);
});

test("class icon pairs expose their localized label", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(<VehicleClassIcons classes={["CAR"]} color={lightTheme.primary} label="Cả xe máy và ô tô" />);
  });
  if (!renderer) throw new Error("render failed");
  expect(renderer.root.findAll((node) => node.props?.accessibilityLabel === "Cả xe máy và ô tô").length).toBeGreaterThan(0);
  await act(async () => {
    renderer?.unmount();
  });
});

test("service categories use their own glyphs and fall back to other", async () => {
  expect(await iconNames(<ServiceCategoryIcon category="FLAT_TIRE" color={lightTheme.primary} />)).toEqual(["tire"]);
  expect(await iconNames(<ServiceCategoryIcon category="BRAKES" color={lightTheme.primary} />)).toEqual(["car-brake-alert"]);
  expect(await iconNames(<ServiceCategoryIcon category="UNKNOWN" color={lightTheme.primary} />)).toEqual(["dots-horizontal"]);
});
