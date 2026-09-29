import {expect, test} from "@jest/globals";
import {vehicleMeta, vehicleTypeName} from "../../../src/components/vehicleMeta";
import {en} from "../../../src/i18n/en";

test("known types resolve to their translated names", () => {
  expect(vehicleTypeName("SCOOTER", en)).toBe("Scooter");
  expect(vehicleTypeName("TRUCK", en)).toBe("Truck");
});

test("unknown types fall back to the raw value", () => {
  expect(vehicleTypeName("HOVERBOARD", en)).toBe("HOVERBOARD");
});

test("meta shows dimensions alone without tow", () => {
  expect(vehicleMeta(0.7, 1.1, null, en)).toBe("0.7 × 1.1 m");
  expect(vehicleMeta(0.7, 1.1, undefined, en)).toBe("0.7 × 1.1 m");
});

test("meta appends the translated tow designation", () => {
  expect(vehicleMeta(1.9, 1.5, "VAN", en)).toBe("1.9 × 1.5 m · Tow vehicle: Van");
});
