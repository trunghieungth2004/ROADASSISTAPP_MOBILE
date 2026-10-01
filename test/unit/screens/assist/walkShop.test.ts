import {expect, test} from "@jest/globals";
import {WALK_RADII, WALK_METERS_PER_MINUTE, walkKm, walkMinutes} from "../../../../src/screens/assist/walkShop";

test("walk radii stay inside the backend walk bounds", () => {
  expect(WALK_RADII).toEqual([500, 1000, 2000]);
  expect(Math.min(...WALK_RADII)).toBeGreaterThanOrEqual(500);
  expect(Math.max(...WALK_RADII)).toBeLessThanOrEqual(2000);
});

test("estimates walking minutes at five kilometers per hour", () => {
  expect(WALK_METERS_PER_MINUTE).toBe(83);
  expect(walkMinutes(830)).toBe(10);
  expect(walkMinutes(100)).toBe(1);
  expect(walkMinutes(0)).toBe(0);
  expect(walkMinutes(Number.NaN)).toBe(0);
});

test("formats walking kilometers with one decimal", () => {
  expect(walkKm(1250)).toBe("1.3");
  expect(walkKm(0)).toBe("0.0");
});
