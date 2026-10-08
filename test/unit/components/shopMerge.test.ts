import {expect, test} from "@jest/globals";
import {mergeShopResults, normalizeShopName} from "../../../src/components/place-search/shopMerge";
import type {Provider} from "../../../src/api/providers";

function shop(id: string, name: string, lat: number, lng: number): Provider {
  return {id, name, lat, lng} as Provider;
}

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
