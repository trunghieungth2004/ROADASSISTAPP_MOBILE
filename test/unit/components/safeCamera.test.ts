import {expect, test} from "@jest/globals";
import {safeCameraCall} from "../../../src/components/map/safeCamera";

test("safeCameraCall swallows a rejected camera promise", () => {
  expect(() => safeCameraCall(() => Promise.reject(new Error("boom")))).not.toThrow();
});

test("safeCameraCall ignores missing cameras", () => {
  expect(() => safeCameraCall(() => undefined)).not.toThrow();
});