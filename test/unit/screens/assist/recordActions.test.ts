import {expect, test} from "@jest/globals";
import {canAccept, canCancel, canDecline, canEditWork, canRate, canRateRider, visibleActions} from "../../../../src/screens/assist/recordActions";

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
  for (const s of ["2", "3", "6"]) expect(canEditWork("in", s)).toBe(true);
  for (const s of ["1", "4", "5", "7", "8"]) expect(canEditWork("in", s)).toBe(false);
  for (const s of ["1", "2", "3", "4", "5", "6", "7", "8"]) expect(canEditWork("out", s)).toBe(false);
});

test("operator rates the rider on resolved inbound jobs", () => {
  expect(canRateRider("in", "4")).toBe(true);
  for (const s of ["1", "2", "3", "5", "6", "7", "8"]) expect(canRateRider("in", s)).toBe(false);
  for (const s of ["1", "2", "3", "4", "5", "6", "7", "8"]) expect(canRateRider("out", s)).toBe(false);
});
