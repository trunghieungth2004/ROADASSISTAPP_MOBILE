import {expect, test} from "@jest/globals";
import {isStaleForRefresh, pickFeedback} from "../../../src/components/feedback";

test("failures surface as errors, successes as confirms", () => {
  expect(pickFeedback("failure")).toBe("error");
  expect(pickFeedback("success")).toBe("confirm");
  expect(pickFeedback("neutral")).toBe("info");
});

test("rapid refocuses are not stale", () => {
  expect(isStaleForRefresh(1000, 1500)).toBe(false);
  expect(isStaleForRefresh(1000, 3000)).toBe(true);
  expect(isStaleForRefresh(0, 2000)).toBe(true);
});
