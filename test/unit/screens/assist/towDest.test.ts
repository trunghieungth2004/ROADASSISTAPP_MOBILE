import {expect, test} from "@jest/globals";
import {declinedShopIds, towDestOf, towProviderPoint} from "../../../../src/screens/assist/towDest";

test("declined shops collect from travel legs", () => {
  expect(declinedShopIds({towLegs: null})).toEqual(new Set());
  expect(declinedShopIds({} as never)).toEqual(new Set());
  expect(
    declinedShopIds({
      towLegs: [
        {toShopId: "shop-1", km: 0, actual: false, at: "2026-01-01T00:00:00.000Z"},
        {toShopId: "", km: 0, actual: false, at: "2026-01-01T00:00:00.000Z"},
        {km: 3, actual: true, at: "2026-01-01T00:00:00.000Z"},
      ],
    }),
  ).toEqual(new Set(["shop-1"]));
});

test("outbound tow origin prefers the tower fix", () => {
  expect(towProviderPoint({
    direction: "out",
    status: "2",
    lat: 10.71,
    lng: 106.61,
    towerFix: {lat: 10.69, lng: 106.59},
  }, {lat: 1, lng: 2})).toEqual({lat: 10.69, lng: 106.59});
});

test("outbound tow origin falls back to the pickup on arrival", () => {
  expect(towProviderPoint({
    direction: "out",
    status: "3",
    lat: 10.71,
    lng: 106.61,
    towerFix: null,
  }, {lat: 1, lng: 2})).toEqual({lat: 10.71, lng: 106.61});
});

test("outbound tow origin never falls back to the rider position", () => {
  expect(towProviderPoint({
    direction: "out",
    status: "2",
    lat: 10.71,
    lng: 106.61,
    towerFix: null,
  }, {lat: 1, lng: 2})).toBeNull();
});

test("inbound tow origin uses the local tower position", () => {
  expect(towProviderPoint({
    direction: "in",
    status: "2",
    lat: 10.71,
    lng: 106.61,
    towerFix: null,
  }, {lat: 1, lng: 2})).toEqual({lat: 1, lng: 2});
});

test("destination resolution prefers party over snapshot over point", () => {
  expect(towDestOf({
    destinationParty: {id: "s", name: "n", kind: "SHOP", lat: 1, lng: 2},
    destinationSnapshot: {lat: 3, lng: 4},
    destinationPoint: {lat: 5, lng: 6},
  } as never)).toEqual({lat: 1, lng: 2});
  expect(towDestOf({destinationSnapshot: null, destinationPoint: null} as never)).toBeNull();
});
