import {expect, test} from "@jest/globals";
import {profileHasProviderRole} from "../../../../src/screens/assist/providerRole";

test("rider-only profiles have no provider workspace", () => {
  expect(profileHasProviderRole(["RIDER"])).toBe(false);
  expect(profileHasProviderRole([])).toBe(false);
  expect(profileHasProviderRole(null)).toBe(false);
  expect(profileHasProviderRole(undefined)).toBe(false);
});

test("shop, tow and mobile shop profiles open the provider workspace", () => {
  expect(profileHasProviderRole(["RIDER", "SHOP"])).toBe(true);
  expect(profileHasProviderRole(["RIDER", "TOW"])).toBe(true);
  expect(profileHasProviderRole(["RIDER", "MOBILE_SHOP"])).toBe(true);
});
