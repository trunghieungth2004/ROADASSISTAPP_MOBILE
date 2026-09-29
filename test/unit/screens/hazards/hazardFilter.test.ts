import {expect, test} from "@jest/globals";
import {filterFlags, timeAgoLabel, type AgoStrings} from "../../../../src/screens/hazards/hazardFilter";
import type {Flag} from "../../../../src/api/flags";

const ago: AgoStrings = {justNow: "Just now", minAgo: "{n} min ago", hourAgo: "{n} hr ago", dayAgo: "{n} days ago"};

function flag(id: string, type: string, createdAt?: string): Flag {
  return {id, type, lat: 10.76, lng: 106.66, status: "1", createdAt};
}

test("ALL returns every flag newest first", () => {
  const flags = [flag("a", "FLOOD", "2026-09-20T10:00:00.000Z"), flag("b", "ACCIDENT", "2026-09-28T10:00:00.000Z"), flag("c", "OBSTRUCTION", "2026-09-25T10:00:00.000Z")];
  expect(filterFlags(flags, "ALL").map((f) => f.id)).toEqual(["b", "c", "a"]);
});

test("type filter keeps only matching flags", () => {
  const flags = [flag("a", "FLOOD", "2026-09-20T10:00:00.000Z"), flag("b", "ACCIDENT", "2026-09-28T10:00:00.000Z")];
  expect(filterFlags(flags, "FLOOD").map((f) => f.id)).toEqual(["a"]);
});

test("flags without a usable timestamp sort last", () => {
  const flags = [flag("a", "FLOOD"), flag("b", "FLOOD", "not-a-date"), flag("c", "FLOOD", "2026-09-28T10:00:00.000Z")];
  expect(filterFlags(flags, "ALL").map((f) => f.id)).toEqual(["c", "a", "b"]);
});

test("timeAgoLabel covers just now through days", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");
  expect(timeAgoLabel("2026-09-29T11:59:40.000Z", now, ago)).toBe("Just now");
  expect(timeAgoLabel("2026-09-29T11:30:00.000Z", now, ago)).toBe("30 min ago");
  expect(timeAgoLabel("2026-09-29T09:00:00.000Z", now, ago)).toBe("3 hr ago");
  expect(timeAgoLabel("2026-09-26T12:00:00.000Z", now, ago)).toBe("3 days ago");
});

test("timeAgoLabel returns null without a usable timestamp", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");
  expect(timeAgoLabel(undefined, now, ago)).toBeNull();
  expect(timeAgoLabel("not-a-date", now, ago)).toBeNull();
});
