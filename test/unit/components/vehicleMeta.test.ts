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

test("meta shows dimensions", () => {
  expect(vehicleMeta(0.7, 1.1)).toBe("0.7 × 1.1 m");
  expect(vehicleMeta(1.9, 1.5)).toBe("1.9 × 1.5 m");
  expect(en.vehicle.types.VAN).toBe("Van");
});
