import {expect, test} from "@jest/globals";
import {parseDispatchPush, parseHazardPush} from "../../../src/services/pushPayload";

test("parses a dispatch offer payload", () => {
  expect(
    parseDispatchPush({ticketId: "t1", ticketType: "SOS", lat: "10.7", lng: "106.6"}),
  ).toEqual({ticketId: "t1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: undefined});
});

test("parses a dispatch status payload", () => {
  expect(parseDispatchPush({ticketId: "t1", status: "2"})).toEqual({
    ticketId: "t1",
    ticketType: undefined,
    lat: undefined,
    lng: undefined,
    status: "2",
  });
});

test("rejects hazard payloads and junk", () => {
  expect(parseDispatchPush({flagId: "f1"})).toBeNull();
  expect(parseDispatchPush({ticketId: ""})).toBeNull();
  expect(parseDispatchPush(null)).toBeNull();
});

test("the hazard parser rejects dispatch payloads", () => {
  expect(parseHazardPush({ticketId: "t1"})).toBeNull();
  expect(parseHazardPush({flagId: "f1", type: "FLOOD"})).toEqual({
    flagId: "f1",
    type: "FLOOD",
    status: undefined,
    lat: undefined,
    lng: undefined,
    radiusMeters: undefined,
    removed: undefined,
  });
});
