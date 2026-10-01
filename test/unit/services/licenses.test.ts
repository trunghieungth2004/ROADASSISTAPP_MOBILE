import {expect, test} from "@jest/globals";
import {hasProviderLicense} from "../../../src/services/licenses";

test("detects provider licenses", () => {
  expect(hasProviderLicense(["RIDER", "VOLUNTEER"])).toBe(true);
  expect(hasProviderLicense(["SHOP"])).toBe(true);
  expect(hasProviderLicense(["TOW"])).toBe(true);
});

test("riders and empty lists are not providers", () => {
  expect(hasProviderLicense(["RIDER"])).toBe(false);
  expect(hasProviderLicense([])).toBe(false);
  expect(hasProviderLicense(undefined)).toBe(false);
});
