import {expect, test} from "@jest/globals";
import {shouldAutoFit, shouldRetryCenter} from "../../../../src/screens/route/cameraIntent";

test("a pending focus beats the initial fit", () => {
  expect(shouldAutoFit({focusPending: true, flagCount: 3, fitted: false})).toBe(false);
});

test("fits once when flags arrive with no focus pending", () => {
  expect(shouldAutoFit({focusPending: false, flagCount: 3, fitted: false})).toBe(true);
});

test("never fits with no flags or after fitting", () => {
  expect(shouldAutoFit({focusPending: false, flagCount: 0, fitted: false})).toBe(false);
  expect(shouldAutoFit({focusPending: false, flagCount: 3, fitted: true})).toBe(false);
  expect(shouldAutoFit({focusPending: true, flagCount: 0, fitted: true})).toBe(false);
});

test("retries the startup center until centered or out of attempts", () => {
  expect(shouldRetryCenter(false, 0, 3)).toBe(true);
  expect(shouldRetryCenter(false, 2, 3)).toBe(true);
  expect(shouldRetryCenter(false, 3, 3)).toBe(false);
  expect(shouldRetryCenter(true, 0, 3)).toBe(false);
});
