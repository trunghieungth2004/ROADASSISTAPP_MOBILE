import {expect, test} from "@jest/globals";
import {declinedShopIds, towDestOf} from "../../../../src/screens/assist/towDest";

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

test("destination resolution prefers party over snapshot over point", () => {
  expect(towDestOf({
    destinationParty: {id: "s", name: "n", kind: "SHOP", lat: 1, lng: 2},
    destinationSnapshot: {lat: 3, lng: 4},
    destinationPoint: {lat: 5, lng: 6},
  } as never)).toEqual({lat: 1, lng: 2});
  expect(towDestOf({destinationSnapshot: null, destinationPoint: null} as never)).toBeNull();
});
