import {expect, test} from "@jest/globals";
import {existingVehicleChoices, matchingVehicles, plateKey} from "../../../src/components/providers/existingVehicles";
import type {Provider} from "../../../src/api/providers";
import type {MeVehicle} from "../../../src/api/users";

function provider(patch: Partial<Provider> & {id: string; kind: Provider["kind"]}): Provider {
  return {
    name: patch.id,
    lat: 10.7,
    lng: 106.6,
    status: "PENDING",
    ...patch,
  };
}

test("cross-role mobile vehicle is suggested for tow", () => {
  const choices = existingVehicleChoices("TOW", null, [
    provider({
      id: "m1",
      kind: "MOBILE_SHOP",
      plate: "51H12345",
      vehicleType: "CAR",
      vehicleWidth: 1.9,
      vehicleHeight: 1.6,
      vehicleLabel: "Mobile car",
    }),
  ], []);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toMatchObject({
    plate: "51H12345",
    vehicleType: "CAR",
    vehicleWidth: 1.9,
    vehicleHeight: 1.6,
    label: "Mobile car",
    kind: "MOBILE_SHOP",
    status: "PENDING",
  });
});

test("same kind pending is hidden but denied can be reapplied", () => {
  const pending = existingVehicleChoices("TOW", null, [
    provider({id: "t1", kind: "TOW", status: "PENDING", plate: "51H11111", vehicleType: "CAR"}),
  ], []);
  expect(pending).toHaveLength(0);
  const denied = existingVehicleChoices("TOW", null, [
    provider({id: "t2", kind: "TOW", status: "DENIED", plate: "51H22222", vehicleType: "CAR"}),
  ], []);
  expect(denied).toHaveLength(1);
  expect(denied[0].status).toBe("DENIED");
});

test("profiles fill missing details and dedupe by plate", () => {
  const vehicles: MeVehicle[] = [{
    id: "v1",
    type: "CAR",
    baseWidth: 2,
    baseHeight: 1.7,
    plate: "51h-12345",
    label: "My car",
  }];
  const choices = existingVehicleChoices("TOW", null, [
    provider({id: "m1", kind: "MOBILE_SHOP", plate: "51H12345", vehicleType: "CAR"}),
  ], vehicles);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toMatchObject({
    plate: "51H12345",
    vehicleWidth: 2,
    vehicleHeight: 1.7,
    label: "My car",
  });
});

test("plate matching accepts separators and hides non-matches", () => {
  const choices = existingVehicleChoices("TOW", null, [
    provider({id: "m1", kind: "MOBILE_SHOP", plate: "51H12345", vehicleType: "CAR"}),
    provider({id: "m2", kind: "MOBILE_SHOP", plate: "59A99999", vehicleType: "CAR"}),
  ], []);
  expect(plateKey("51h-123.45")).toBe("51H12345");
  expect(matchingVehicles(choices, "51h-123.45").map((row) => row.plate)).toEqual(["51H12345"]);
  expect(matchingVehicles(choices, "")).toHaveLength(2);
});
