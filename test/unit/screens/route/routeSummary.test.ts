import {expect, test} from "@jest/globals";
import {pillMeta, stopCacheKey, suggestRouteName} from "../../../../src/screens/route/routeSummary";
import type {RouteOption} from "../../../../src/api/routes";

function option(hazards: number): RouteOption {
  return {
    source: "test",
    geometry: {type: "LineString", coordinates: []},
    distanceMeters: 1200,
    durationSeconds: 180,
    hazards: Array.from({length: hazards}, (_, i) => ({flagId: `f${i}`, lat: 0, lng: 0, radiusMeters: 100, distanceMeters: 100})),
  };
}

test("suggestRouteName joins origin and destination", () => {
  expect(suggestRouteName("A St", "B Ave")).toBe("A St → B Ave");
  expect(suggestRouteName("A St", "")).toBe("A St");
  expect(suggestRouteName("", "")).toBe("");
});

test("stopCacheKey rounds coordinates", () => {
  expect(stopCacheKey(10.76264, 106.66024)).toBe("10.7626,106.6602");
  expect(stopCacheKey(10.76264, 106.66024)).toBe(stopCacheKey(10.762649, 106.660249));
});

test("pillMeta marks the fewest-hazard option best", () => {
  const routes = [option(2), option(0), option(1)];
  expect(pillMeta(routes, 0)).toEqual({hazards: 2, best: false});
  expect(pillMeta(routes, 1)).toEqual({hazards: 0, best: true});
  expect(pillMeta(routes, 2)).toEqual({hazards: 1, best: false});
});

test("pillMeta treats ties as best and missing hazards as zero", () => {
  const routes = [option(0), option(0)];
  expect(pillMeta(routes, 0).best).toBe(true);
  expect(pillMeta(routes, 5)).toEqual({hazards: 0, best: true});
  expect(pillMeta([], 0)).toEqual({hazards: 0, best: true});
});
