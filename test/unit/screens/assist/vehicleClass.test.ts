import {expect, test} from "@jest/globals";
import {vehicleClassOf} from "../../../../src/screens/assist/vehicleClass";

test("maps rider vehicle types to classes", () => {
  expect(vehicleClassOf("SCOOTER")).toBe("SOLO_BIKE");
  expect(vehicleClassOf("CUB")).toBe("SOLO_BIKE");
  expect(vehicleClassOf("MANUAL")).toBe("SOLO_BIKE");
  expect(vehicleClassOf("CAR")).toBe("CAR");
  expect(vehicleClassOf("VAN")).toBe("CAR");
  expect(vehicleClassOf("TRUCK")).toBe("CAR");
});

test("unknown and missing types map to null", () => {
  expect(vehicleClassOf("BOAT")).toBeNull();
  expect(vehicleClassOf(null)).toBeNull();
  expect(vehicleClassOf(undefined)).toBeNull();
  expect(vehicleClassOf("")).toBeNull();
});
