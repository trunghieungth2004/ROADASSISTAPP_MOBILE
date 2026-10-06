import {expect, test} from "@jest/globals";
import {isRouteStale, touchCapReached, ROUTE_RETOUCH_MS, ROUTE_STALE_MS, ROUTE_TOUCH_CAP_MS} from "../../../../src/screens/route/routeFresh";

test("retouch runs before the stale line", () => {
  expect(ROUTE_RETOUCH_MS).toBeLessThan(ROUTE_STALE_MS);
});

test("cap spans an hour, not minutes", () => {
  expect(ROUTE_TOUCH_CAP_MS).toBe(60 * 60 * 1000);
});

test("missing check time is stale", () => {
  expect(isRouteStale(null, 1000)).toBe(true);
});

test("fresh inside the window, stale past it", () => {
  expect(isRouteStale(0, ROUTE_STALE_MS - 1)).toBe(false);
  expect(isRouteStale(0, ROUTE_STALE_MS)).toBe(true);
  expect(isRouteStale(0, ROUTE_STALE_MS + 1)).toBe(true);
});

test("touch window stays open inside the hour", () => {
  expect(touchCapReached(null, 1000)).toBe(false);
  expect(touchCapReached(0, ROUTE_TOUCH_CAP_MS - 1)).toBe(false);
  expect(touchCapReached(0, ROUTE_TOUCH_CAP_MS)).toBe(true);
});
