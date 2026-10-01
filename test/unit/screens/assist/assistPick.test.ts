import {expect, test} from "@jest/globals";
import {ticketById, toggleSelected} from "../../../../src/screens/assist/assistPick";

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
