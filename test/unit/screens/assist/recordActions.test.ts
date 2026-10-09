import {expect, test} from "@jest/globals";
import {canAccept, canApproveQuote, canCancel, canDecline, canDeclineDestination, canEditWork, canMarkReady, canRate, canRateRider, canSendQuote, canStartWork, visibleActions} from "../../../../src/screens/assist/recordActions";

test("rate only on resolved", () => {
  expect(canRate("4")).toBe(true);
  for (const s of ["1", "2", "3", "5", "6", "7", "8"]) expect(canRate(s)).toBe(false);
});

test("cancel on pending and matched", () => {
  expect(canCancel("1")).toBe(true);
  expect(canCancel("2")).toBe(true);
  for (const s of ["3", "4", "5", "6", "7", "8"]) expect(canCancel(s)).toBe(false);
});

test("visible actions follow the rider matrix", () => {
  expect(visibleActions("1")).toEqual(["cancel"]);
  expect(visibleActions("2")).toEqual(["arrived", "cancel"]);
  expect(visibleActions("3")).toEqual(["resolved", "cancel"]);
  expect(visibleActions("7")).toEqual(["resolved", "cancel"]);
  expect(visibleActions("4")).toEqual([]);
  expect(visibleActions("5")).toEqual([]);
  expect(visibleActions("8")).toEqual([]);
});

test("operator takes pending inbound jobs", () => {
  expect(canAccept("in", "1")).toBe(true);
  expect(canDecline("in", "1")).toBe(true);
  for (const s of ["2", "3", "4", "5", "6", "7", "8"]) {
    expect(canAccept("in", s)).toBe(false);
    expect(canDecline("in", s)).toBe(false);
  }
  for (const s of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
    expect(canAccept("out", s)).toBe(false);
    expect(canDecline("out", s)).toBe(false);
  }
});

test("operator edits open inbound work orders", () => {
  for (const s of ["2", "3", "6"]) expect(canEditWork("in", s, true)).toBe(true);
  for (const s of ["1", "4", "5", "7", "8"]) expect(canEditWork("in", s, true)).toBe(false);
  for (const s of ["1", "2", "3", "4", "5", "6", "7", "8"]) expect(canEditWork("out", s, true)).toBe(false);
  for (const s of ["2", "3", "6"]) expect(canEditWork("in", s, false)).toBe(false);
});

test("operator rates the rider on resolved inbound jobs", () => {
  expect(canRateRider("in", "4")).toBe(true);
  for (const s of ["1", "2", "3", "5", "6", "7", "8"]) expect(canRateRider("in", s)).toBe(false);
  for (const s of ["1", "2", "3", "4", "5", "6", "7", "8"]) expect(canRateRider("out", s)).toBe(false);
});

test("operator starts arrived jobs and walk-ins from matched", () => {
  expect(canStartWork("in", "3", "SOS", false, true)).toBe(true);
  expect(canStartWork("in", "2", "WALK_IN", false, true)).toBe(true);
  expect(canStartWork("in", "2", "SOS", false, true)).toBe(false);
  expect(canStartWork("in", "2", "WALK_IN", true, true)).toBe(false);
  expect(canStartWork("out", "3", "SOS", false, true)).toBe(false);
  expect(canStartWork("in", "3", "SOS", false, false)).toBe(false);
  expect(canStartWork("in", "6", "WALK_IN", false, true)).toBe(false);
  expect(canMarkReady("in", "6", true)).toBe(true);
  expect(canMarkReady("in", "2", true)).toBe(false);
  expect(canMarkReady("in", "6", false)).toBe(false);
  expect(canMarkReady("out", "6", true)).toBe(false);
});

test("destination decline belongs to the destination shop once matched", () => {
  const mine = new Set(["shop-1"]);
  expect(canDeclineDestination("2", "shop-1", mine)).toBe(true);
  for (const s of ["3", "6", "7"]) expect(canDeclineDestination(s, "shop-1", mine)).toBe(true);
  expect(canDeclineDestination("1", "shop-1", mine)).toBe(false);
  for (const s of ["4", "5", "8"]) expect(canDeclineDestination(s, "shop-1", mine)).toBe(false);
  expect(canDeclineDestination("2", "shop-2", mine)).toBe(false);
  expect(canDeclineDestination("2", null, mine)).toBe(false);
  expect(canDeclineDestination("2", "", mine)).toBe(false);
});

test("quote handshake gates both sides", () => {
  expect(canSendQuote("in", "2", true)).toBe(true);
  expect(canSendQuote("in", "3", true)).toBe(true);
  expect(canSendQuote("in", "6", true)).toBe(false);
  expect(canSendQuote("in", "2", false)).toBe(false);
  expect(canSendQuote("out", "2", true)).toBe(false);
  expect(canApproveQuote("out", "9")).toBe(true);
  expect(canApproveQuote("out", "2")).toBe(false);
  expect(canApproveQuote("in", "9")).toBe(false);
  expect(canCancel("9")).toBe(true);
});
