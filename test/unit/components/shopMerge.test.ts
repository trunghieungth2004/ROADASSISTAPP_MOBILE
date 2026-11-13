import {expect, jest, test} from "@jest/globals";
import {dropNearDuplicates, fetchShopPlaces, mergeShopResults, normalizeShopName} from "../../../src/components/place-search/shopMerge";
import {searchProviders, type Provider} from "../../../src/api/providers";

jest.mock("../../../src/api/providers", () => ({
  searchProviders: jest.fn(),
}));

function shop(id: string, name: string, lat: number, lng: number): Provider {
  return {id, name, lat, lng} as Provider;
}

test("tow shop search hides off-duty shops", async () => {
  jest.mocked(searchProviders).mockResolvedValue([
    {id: "on", name: "On", kind: "SHOP", lat: 10.7, lng: 106.6, accepting: true},
    {id: "off", name: "Off", kind: "SHOP", lat: 10.71, lng: 106.61, accepting: false},
  ] as never);
  const rows = await fetchShopPlaces(
    "",
    "tok",
    {lat: 10.7, lng: 106.6},
    undefined,
    20000,
    true,
    {acceptingOnly: true},
  );
  expect(rows.map((row) => row.id)).toEqual(["on"]);
});

test("forwards price ranking filters and maps estimates", async () => {
  jest.mocked(searchProviders).mockResolvedValue([
    {
      id: "s1",
      name: "Good Shop",
      kind: "SHOP",
      lat: 10.7,
      lng: 106.6,
      accepting: true,
      estimatedServicePrice: 100000,
      estimatedTravelFee: 40000,
      estimatedTotal: 140000,
      estimatedDistanceKm: 5,
      pricingMode: "FIXED",
      matchedServiceCode: "ENGINE_FIX",
    },
  ] as never);
  const rows = await fetchShopPlaces(
    "fix",
    "tok",
    {lat: 10.7, lng: 106.6},
    "SOLO_BIKE",
    undefined,
    true,
    {sortBy: "price", serviceCategory: "ENGINE"},
  );
  expect(searchProviders).toHaveBeenCalledWith(
    10.7,
    106.6,
    "fix",
    "tok",
    expect.objectContaining({
      sortBy: "price",
      serviceCategory: "ENGINE",
      vehicleClass: "SOLO_BIKE",
    }),
  );
  expect(rows[0]).toMatchObject({
    estimatedServicePrice: 100000,
    estimatedTravelFee: 40000,
    estimatedTotal: 140000,
    estimatedDistanceKm: 5,
    pricingMode: "FIXED",
    matchedServiceCode: "ENGINE_FIX",
  });
});

test("normalizeShopName folds case and diacritics", () => {
  expect(normalizeShopName("Tiệm Sửa Xe")).toBe("tiem sua xe");
  expect(normalizeShopName("Good-Shop!")).toBe("good shop");
});

test("duplicates merge by name and proximity", () => {
  const shops = [shop("s1", "Good Shop", 10.71, 106.61)];
  const mapShops = mergeShopResults(
    shops,
    [
      {label: "Good Shop", lat: 10.7101, lng: 106.6101, source: "map", category: "repair"},
      {label: "Good Shop Far", lat: 10.8, lng: 106.7, source: "map", category: "repair"},
      {label: "Cafe Trung", lat: 10.71, lng: 106.61, source: "map", category: "cafe"},
      {label: "Repair Pro", lat: 10.72, lng: 106.62, source: "map", category: "repair"},
    ],
    {lat: 10.7, lng: 106.6},
  );
  expect(mapShops.map((m) => m.label)).toEqual(["Repair Pro", "Good Shop Far"]);
});

test("merge caps map results and sorts by distance", () => {
  const places = Array.from({length: 8}, (_, i) => ({
    label: `Repair ${i}`,
    lat: 10.7 + i * 0.001,
    lng: 106.6,
    source: "map" as const,
    category: "repair",
  }));
  const mapShops = mergeShopResults([], places, {lat: 10.7, lng: 106.6});
  expect(mapShops).toHaveLength(5);
  expect(mapShops[0]?.label).toBe("Repair 0");
});

test("near duplicates keep different provider kinds but drop map twins", () => {
  const rows = dropNearDuplicates([
    {label: "Same Name", lat: 10.71, lng: 106.61, source: "directory", id: "s1", providerKind: "SHOP"},
    {label: "Same Name", lat: 10.71, lng: 106.61, source: "directory", id: "t1", providerKind: "TOW"},
    {label: "Same Name", lat: 10.7101, lng: 106.6101, source: "map", category: "repair"},
  ]);
  expect(rows.map((row) => row.providerKind ?? "MAP")).toEqual(["SHOP", "TOW"]);
});
