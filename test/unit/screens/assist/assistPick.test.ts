import {expect, test} from "@jest/globals";
import {coordOf, ticketById, toggleSelected} from "../../../../src/screens/assist/assistPick";

test("parses map press coordinates", () => {
  expect(coordOf({geometry: {coordinates: [106.66, 10.76]}})).toEqual({lng: 106.66, lat: 10.76});
});

test("rejects malformed press events", () => {
  expect(coordOf(null)).toBeNull();
  expect(coordOf({geometry: {coordinates: ["x", 1]}})).toBeNull();
  expect(coordOf({geometry: {}})).toBeNull();
});

test("finds tickets by id", () => {
  const list = [{id: "a", userId: "u", ticketType: "SOS", lat: 1, lng: 2, status: "1"}];
  expect(ticketById(list, "a")?.id).toBe("a");
  expect(ticketById(list, "missing")).toBeNull();
});

test("toggles ticket selection", () => {
  expect(toggleSelected(null, "a")).toBe("a");
  expect(toggleSelected("a", "a")).toBeNull();
  expect(toggleSelected("a", "b")).toBe("b");
});
