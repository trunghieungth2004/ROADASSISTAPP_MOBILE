import {expect, test} from "@jest/globals";
import {RECORD_FILTERS, businessKindOf, directionOf, filterByKind, filterRecords, roleIconName} from "../../../../src/screens/assist/recordFilter";
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

test("business kind resolves through assignment, then type", () => {
  const kinds = new Map([["shop9", "SHOP"], ["tow7", "TOW"]] as [string, "SHOP" | "TOW"][]);
  const assigned = {id: "a", userId: "u", ticketType: "SOS", lat: 0, lng: 0, status: "1", direction: "in", assignedShopId: "shop9"} as never;
  const addressed = {id: "b", userId: "u", ticketType: "WALK_IN", lat: 0, lng: 0, status: "1", direction: "out", providerId: "tow7"} as never;
  const typed = {id: "c", userId: "u", ticketType: "TOW", lat: 0, lng: 0, status: "1", direction: "out"} as never;
  const plain = {id: "d", userId: "u", ticketType: "SOS", lat: 0, lng: 0, status: "1", direction: "out"} as never;
  expect(businessKindOf(assigned, kinds)).toBe("SHOP");
  expect(businessKindOf(addressed, kinds)).toBe("TOW");
  expect(businessKindOf(typed, kinds)).toBe("TOW");
  expect(businessKindOf(plain, kinds)).toBeNull();
  const all = [assigned, addressed, typed, plain];
  expect(filterByKind(all, true, true, true, kinds).map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  expect(filterByKind(all, true, false, true, kinds).map((t) => t.id)).toEqual(["a", "d"]);
  expect(filterByKind(all, false, true, true, kinds).map((t) => t.id)).toEqual(["b", "c", "d"]);
  expect(filterByKind(all, false, false, false, kinds).map((t) => t.id)).toEqual([]);
});

test("rider chip gates kind-less rows", () => {
  const kinds = new Map<string, "SHOP" | "TOW">();
  const shop = {id: "a", userId: "u", ticketType: "WALK_IN", lat: 0, lng: 0, status: "1", direction: "in"} as never;
  const plain = {id: "b", userId: "u", ticketType: "SOS", lat: 0, lng: 0, status: "1", direction: "out"} as never;
  expect(filterByKind([shop, plain], true, true, false, kinds).map((t) => t.id)).toEqual(["a"]);
  expect(roleIconName("SHOP")).toEqual({set: "material", name: "storefront"});
  expect(roleIconName("TOW")).toEqual({set: "community", name: "tow-truck"});
  expect(roleIconName(null)).toEqual({set: "material", name: "person"});
});
