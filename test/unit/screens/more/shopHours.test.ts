import {expect, test} from "@jest/globals";
import {buildOpenHours, emptyWeek, fillWeek, fillWeekdays, formatTimeInput, isOvernight, isValidTime, parseOpenHours, summarizeWeek, validateWeek} from "../../../../src/screens/more/shopHours";
import {en} from "../../../../src/i18n/en";

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

test("formats partial time input with an auto-inserted colon", () => {
  expect(formatTimeInput("", "")).toBe("");
  expect(formatTimeInput("", "8")).toBe("08:");
  expect(formatTimeInput("", "08")).toBe("08:");
  expect(formatTimeInput("08:", "08:3")).toBe("08:3");
  expect(formatTimeInput("08:3", "08:30")).toBe("08:30");
  expect(formatTimeInput("", "083045")).toBe("08:30");
  expect(formatTimeInput("", "ab")).toBe("");
});

test("lets the user backspace through the auto-inserted colon", () => {
  expect(formatTimeInput("08:", "08")).toBe("08");
  expect(formatTimeInput("08", "0")).toBe("0");
  expect(formatTimeInput("08:30", "08:3")).toBe("08:3");
});

test("fills every day or weekdays only", () => {
  expect(buildOpenHours(fillWeek("07:00", "19:00"))).toBe(
    "MON 07:00-19:00,TUE 07:00-19:00,WED 07:00-19:00,THU 07:00-19:00,FRI 07:00-19:00,SAT 07:00-19:00,SUN 07:00-19:00",
  );
  const weekdays = fillWeekdays("08:00", "18:00");
  expect(weekdays.SUN.enabled).toBe(false);
  expect(buildOpenHours(weekdays)).toBe(
    "MON 08:00-18:00,TUE 08:00-18:00,WED 08:00-18:00,THU 08:00-18:00,FRI 08:00-18:00,SAT 08:00-18:00",
  );
});

test("summarizes uniform, mixed, and empty weeks", () => {
  expect(summarizeWeek(emptyWeek(), en.provider.days, en.provider.hoursMixed)).toBeNull();
  const uniform = fillWeekdays("08:00", "18:00");
  expect(summarizeWeek(uniform, en.provider.days, en.provider.hoursMixed)).toBe("Mon–Sat · 08:00–18:00");
  const single = emptyWeek();
  single.SUN = {enabled: true, open: "09:00", close: "12:00"};
  expect(summarizeWeek(single, en.provider.days, en.provider.hoursMixed)).toBe("Sun · 09:00–12:00");
  const mixed = fillWeekdays("08:00", "18:00");
  mixed.WED = {enabled: true, open: "09:00", close: "12:00"};
  expect(summarizeWeek(mixed, en.provider.days, en.provider.hoursMixed)).toBe("6 days");
});

test("round-trips an overnight interval", () => {
  const week = emptyWeek();
  week.SAT = {enabled: true, open: "22:00", close: "02:00"};
  expect(isOvernight("22:00", "02:00")).toBe(true);
  expect(isOvernight("08:00", "18:00")).toBe(false);
  expect(isOvernight("bad", "02:00")).toBe(false);
  const raw = buildOpenHours(week);
  expect(raw).toBe("SAT 22:00-02:00");
  const parsed = parseOpenHours(raw);
  expect(parsed.SAT).toEqual({enabled: true, open: "22:00", close: "02:00"});
  expect(validateWeek(week)).toBe(true);
});
