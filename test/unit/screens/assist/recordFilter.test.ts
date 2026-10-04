import {expect, test} from "@jest/globals";
import {RECORD_FILTERS, directionOf, filterRecords} from "../../../../src/screens/assist/recordFilter";
import type {FeedTicket} from "../../../../src/api/dispatch";

function ticket(id: string, direction: "in" | "out"): FeedTicket {
  return {id, userId: "u1", ticketType: "SOS", lat: 0, lng: 0, status: "1", direction};
}

test("filters list the three tabs", () => {
  expect(RECORD_FILTERS).toEqual(["ALL", "IN", "OUT"]);
});

test("direction reads the server stamp", () => {
  expect(directionOf(ticket("a", "in"))).toBe("in");
  expect(directionOf(ticket("b", "out"))).toBe("out");
});

test("filter keeps server order without re-sorting", () => {
  const tickets = [ticket("a", "out"), ticket("b", "in"), ticket("c", "out")];
  expect(filterRecords(tickets, "ALL").map((t) => t.id)).toEqual(["a", "b", "c"]);
  expect(filterRecords(tickets, "IN").map((t) => t.id)).toEqual(["b"]);
  expect(filterRecords(tickets, "OUT").map((t) => t.id)).toEqual(["a", "c"]);
  expect(tickets.map((t) => t.id)).toEqual(["a", "b", "c"]);
});
