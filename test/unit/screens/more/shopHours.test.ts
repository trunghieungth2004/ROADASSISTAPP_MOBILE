import {expect, test} from "@jest/globals";
import {buildOpenHours, emptyWeek, isValidTime, parseOpenHours, validateWeek} from "../../../../src/screens/more/shopHours";

test("validates 24-hour times", () => {
  expect(isValidTime("08:00")).toBe(true);
  expect(isValidTime("23:59")).toBe(true);
  expect(isValidTime("8:00")).toBe(false);
  expect(isValidTime("24:00")).toBe(false);
  expect(isValidTime("08:60")).toBe(false);
  expect(isValidTime("")).toBe(false);
});

test("round-trips the backend day-interval format", () => {
  const week = emptyWeek();
  week.MON = {enabled: true, open: "08:00", close: "18:00"};
  week.SAT = {enabled: true, open: "09:00", close: "12:00"};
  const raw = buildOpenHours(week);
  expect(raw).toBe("MON 08:00-18:00,SAT 09:00-12:00");
  const parsed = parseOpenHours(raw);
  expect(parsed.MON.enabled).toBe(true);
  expect(parsed.SAT).toEqual({enabled: true, open: "09:00", close: "12:00"});
  expect(parsed.TUE.enabled).toBe(false);
});

test("returns null when nothing is enabled or a time is invalid", () => {
  expect(buildOpenHours(emptyWeek())).toBeNull();
  const week = emptyWeek();
  week.FRI = {enabled: true, open: "bad", close: "18:00"};
  expect(buildOpenHours(week)).toBeNull();
  expect(validateWeek(week)).toBe(false);
  expect(validateWeek(emptyWeek())).toBe(true);
});

test("ignores malformed entries when parsing", () => {
  const parsed = parseOpenHours("MON 08:00-18:00,garbage,XXX 99:99-99:99");
  expect(parsed.MON.enabled).toBe(true);
  expect(parsed.TUE.enabled).toBe(false);
  expect(parseOpenHours(null).MON.enabled).toBe(false);
});
