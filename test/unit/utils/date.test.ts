import {expect, test} from "@jest/globals";
import {formatDateDMY, formatDateTimeDMY, formatDayMonth, parseDateDMY} from "../../../src/utils/date";

test("formats API day keys as DD/MM/YYYY without timezone drift", () => {
  expect(formatDateDMY("2026-11-18")).toBe("18/11/2026");
  expect(formatDateDMY("2026-01-02")).toBe("02/01/2026");
  expect(formatDateDMY("")).toBe("");
});

test("formats local timestamps with date and time", () => {
  const value = new Date(2026, 10, 18, 14, 30);
  expect(formatDateTimeDMY(value)).toBe("18/11/2026 14:30");
});

test("parses DD/MM/YYYY and rejects impossible dates", () => {
  expect(parseDateDMY("18/11/2026")).toBe("2026-11-18");
  expect(parseDateDMY("31/02/2026")).toBeNull();
  expect(parseDateDMY("2026-11-18")).toBeNull();
  expect(formatDayMonth("2026-11-18")).toBe("18/11");
});
