import {expect, test} from "@jest/globals";
import {darkTheme, lightTheme, onColor} from "../../src/theme";

test("light accent colors keep white foregrounds", () => {
  expect(onColor(lightTheme.primary)).toBe("#ffffff");
  expect(onColor(lightTheme.success)).toBe("#ffffff");
  expect(onColor(lightTheme.danger)).toBe("#ffffff");
});

test("bright dark-mode accents flip to a dark foreground", () => {
  expect(onColor(darkTheme.primary)).toBe("#111111");
  expect(onColor(darkTheme.success)).toBe("#111111");
  expect(onColor(darkTheme.danger)).toBe("#111111");
});

test("amber status colors pick the readable foreground", () => {
  expect(onColor("#d97706")).toBe("#ffffff");
  expect(onColor("#f59e0b")).toBe("#111111");
});
