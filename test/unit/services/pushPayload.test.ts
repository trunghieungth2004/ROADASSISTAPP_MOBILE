import {expect, test} from "@jest/globals";
import {parseDispatchPush, parseHazardPush, parsePaymentPush} from "../../../src/services/pushPayload";

test("parses a dispatch offer payload", () => {
  expect(
    parseDispatchPush({ticketId: "t1", ticketType: "SOS", lat: "10.7", lng: "106.6"}),
  ).toEqual({ticketId: "t1", ticketType: "SOS", lat: 10.7, lng: 106.6, status: undefined, declineReason: undefined, urgent: undefined});
});

test("parses a dispatch status payload", () => {
  expect(parseDispatchPush({ticketId: "t1", status: "2"})).toEqual({
    ticketId: "t1",
    ticketType: undefined,
    lat: undefined,
    lng: undefined,
    status: "2",
    declineReason: undefined,
    urgent: undefined,
  });
});

test("reads the urgent flag from string and boolean forms", () => {
  expect(parseDispatchPush({ticketId: "t1", urgent: "true"})?.urgent).toBe(true);
  expect(parseDispatchPush({ticketId: "t1", urgent: true})?.urgent).toBe(true);
  expect(parseDispatchPush({ticketId: "t1", urgent: "false"})?.urgent).toBeUndefined();
  expect(parseDispatchPush({ticketId: "t1", urgent: "yes"})?.urgent).toBeUndefined();
  expect(parseDispatchPush({ticketId: "t1"})?.urgent).toBeUndefined();
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

test("parses payment and payout deep links", () => {
  expect(parsePaymentPush({
    screen: "payments",
    event: "PAYMENT_OPENED",
    paymentId: "p1",
    ticketId: "t1",
  })).toEqual({event: "PAYMENT_OPENED", paymentId: "p1", ticketId: "t1"});
  expect(parsePaymentPush({
    screen: "payments",
    event: "PAYOUT_SETTLED",
    paymentId: "",
    ticketId: "",
    payoutId: "batch1",
  })).toEqual({event: "PAYOUT_SETTLED", paymentId: "", ticketId: "", payoutId: "batch1"});
});

test("payment parser rejects other screens, missing events and empty targets", () => {
  expect(parsePaymentPush({screen: "dispatch", event: "PAYMENT_OPENED", ticketId: "t1"})).toBeNull();
  expect(parsePaymentPush({screen: "payments", event: "", ticketId: "t1"})).toBeNull();
  expect(parsePaymentPush({screen: "payments", event: "PAYMENT_OPENED"})).toBeNull();
  expect(parsePaymentPush(null)).toBeNull();
});
