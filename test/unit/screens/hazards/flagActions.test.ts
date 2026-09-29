import {expect, test} from "@jest/globals";
import {flagActions, formatUntil, joinMeta, type UntilStrings} from "../../../../src/screens/hazards/flagActions";

const until: UntilStrings = {expiresIn: "Expires in {n}", expired: "Expired"};

test("own suggested and confirmed reports offer remove", () => {
  expect(flagActions("1", true)).toEqual(["remove"]);
  expect(flagActions("2", true)).toEqual(["remove"]);
});

test("own locked reports explain the lock instead of actions", () => {
  expect(flagActions("3", true)).toEqual(["locked"]);
});

test("other suggested reports offer confirm and deny", () => {
  expect(flagActions("1", false)).toEqual(["confirm", "deny"]);
});

test("other confirmed and locked reports offer nothing", () => {
  expect(flagActions("2", false)).toEqual([]);
  expect(flagActions("3", false)).toEqual([]);
});

test("unknown statuses offer nothing", () => {
  expect(flagActions("4", true)).toEqual([]);
  expect(flagActions("9", false)).toEqual([]);
});

test("joinMeta skips missing parts", () => {
  expect(joinMeta(["3 votes", "2/3 confirmations", "Expires in 5h"])).toBe("3 votes · 2/3 confirmations · Expires in 5h");
  expect(joinMeta(["3 votes", null, ""])).toBe("3 votes");
  expect(joinMeta([null, null])).toBe("");
});
test("formatUntil returns null without an expiry", () => {
  expect(formatUntil(null, 1000, until)).toBeNull();
  expect(formatUntil(undefined, 1000, until)).toBeNull();
});

test("formatUntil reports expired and remaining time", () => {
  const now = 1700000000000;
  expect(formatUntil(now - 1000, now, until)).toBe("Expired");
  expect(formatUntil(now + 30 * 60000, now, until)).toBe("Expires in 30m");
  expect(formatUntil(now + 5 * 3600000, now, until)).toBe("Expires in 5h");
  expect(formatUntil(now + 3 * 86400000, now, until)).toBe("Expires in 3d");
});
