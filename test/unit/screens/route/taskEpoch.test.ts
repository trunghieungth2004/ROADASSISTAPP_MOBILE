import {expect, test} from "@jest/globals";
import {createTaskEpoch} from "../../../../src/screens/route/taskEpoch";

test("the latest claim is current", () => {
  const epoch = createTaskEpoch();
  const id = epoch.claim();
  expect(epoch.current(id)).toBe(true);
});

test("a newer claim voids the previous one", () => {
  const epoch = createTaskEpoch();
  const first = epoch.claim();
  const second = epoch.claim();
  expect(epoch.current(first)).toBe(false);
  expect(epoch.current(second)).toBe(true);
});

test("invalidate voids in-flight claims", () => {
  const epoch = createTaskEpoch();
  const id = epoch.claim();
  epoch.invalidate();
  expect(epoch.current(id)).toBe(false);
  expect(epoch.current(epoch.claim())).toBe(true);
});
