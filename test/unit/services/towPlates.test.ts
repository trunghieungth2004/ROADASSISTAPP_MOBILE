import {expect, test} from "@jest/globals";
import {isValidTowPlate, normalizeTowPlate, parseTowWidth, validateTowDraft} from "../../../src/services/towPlates";

test("normalizes plate spellings to one key", () => {
  expect(normalizeTowPlate("30a-123.45")).toBe("30A12345");
  expect(normalizeTowPlate(" 51f 54321 ")).toBe("51F54321");
});

test("accepts Vietnamese plate shapes only", () => {
  expect(isValidTowPlate("30A-12345")).toBe(true);
  expect(isValidTowPlate("29B1-23456")).toBe(true);
  expect(isValidTowPlate("ABC")).toBe(false);
  expect(isValidTowPlate("")).toBe(false);
});

test("parses tow widths inside the backend bounds", () => {
  expect(parseTowWidth("2.0")).toBe(2);
  expect(parseTowWidth("0,8")).toBe(0.8);
  expect(parseTowWidth("0.2")).toBeNull();
  expect(parseTowWidth("5")).toBeNull();
  expect(parseTowWidth("wide")).toBeNull();
});

test("validates a tow draft field by field", () => {
  expect(validateTowDraft({plate: "30A12345", vehicleType: "VAN", width: "2"})).toBeNull();
  expect(validateTowDraft({plate: "bad", vehicleType: "VAN", width: "2"})).toBe("plate");
  expect(validateTowDraft({plate: "30A12345", vehicleType: "BIKE", width: "2"})).toBe("type");
  expect(validateTowDraft({plate: "30A12345", vehicleType: "VAN", width: "x"})).toBe("width");
});
