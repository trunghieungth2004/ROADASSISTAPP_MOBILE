import {expect, test} from "@jest/globals";
import {missingKinds, providerPill, providerStatusLabel, switchEnabled} from "../../../../src/screens/more/providerUi";
import {en} from "../../../../src/i18n/en";

test("status label prefers suspension over status", () => {
  expect(providerStatusLabel({status: "ACTIVE", suspended: true}, en)).toBe(en.provider.suspended);
  expect(providerStatusLabel({status: "ACTIVE"}, en)).toBe(en.provider.active);
  expect(providerStatusLabel({status: "PENDING"}, en)).toBe(en.provider.pending);
  expect(providerStatusLabel({status: "DENIED"}, en)).toBe(en.provider.denied);
  expect(providerStatusLabel({status: "SOMETHING_NEW"}, en)).toBe(en.provider.pending);
});

test("pill separates duty from approval state", () => {
  expect(providerPill({status: "ACTIVE", accepting: true}, en)).toEqual({label: en.provider.active, tone: "on"});
  expect(providerPill({status: "ACTIVE", accepting: false}, en)).toEqual({label: en.provider.offDuty, tone: "off"});
  expect(providerPill({status: "PENDING", accepting: true}, en)).toEqual({label: en.provider.pending, tone: "off"});
  expect(providerPill({status: "DENIED", accepting: true}, en)).toEqual({label: en.provider.denied, tone: "alert"});
  expect(providerPill({status: "ACTIVE", accepting: true, suspended: true}, en)).toEqual({label: en.provider.suspended, tone: "alert"});
});

test("switch is only enabled for live providers", () => {
  expect(switchEnabled({status: "ACTIVE"}, false)).toBe(true);
  expect(switchEnabled({status: "ACTIVE", suspended: true}, false)).toBe(false);
  expect(switchEnabled({status: "PENDING"}, false)).toBe(false);
  expect(switchEnabled({status: "ACTIVE"}, true)).toBe(false);
});

test("cta visibility is per kind, not per list", () => {
  expect(missingKinds([])).toEqual({shop: true, tow: true});
  expect(missingKinds([{kind: "SHOP", status: "ACTIVE"}])).toEqual({shop: false, tow: true});
  expect(missingKinds([{kind: "TOW", status: "DENIED"}])).toEqual({shop: true, tow: true});
  expect(missingKinds([{kind: "TOW", status: "PENDING"}])).toEqual({shop: true, tow: false});
});
