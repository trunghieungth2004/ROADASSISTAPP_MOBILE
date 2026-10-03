import {expect, test} from "@jest/globals";
import {flagActions, flagOverlayActions, formatUntil, joinMeta, type UntilStrings} from "../../../../src/screens/hazards/flagActions";

const until: UntilStrings = {expiresIn: "Expires in {n}", expired: "Expired"};

test("own suggested and confirmed reports offer remove", () => {
  expect(flagActions("1", true)).toEqual(["remove"]);
  expect(flagActions("2", true)).toEqual(["remove"]);
});

test("own locked reports explain the lock instead of actions", () => {
  expect(flagActions("3", true)).toEqual(["locked"]);
});

test("other suggested reports offer confirm and deny", () => {
  expect(flagActions("1", false)).toEqual(["confirm", "deny"]);
});

test("other confirmed and locked reports offer nothing", () => {
  expect(flagActions("2", false)).toEqual([]);
  expect(flagActions("3", false)).toEqual([]);
});

test("unknown statuses offer nothing", () => {
  expect(flagActions("4", true)).toEqual([]);
  expect(flagActions("9", false)).toEqual([]);
});

test("joinMeta skips missing parts", () => {
  expect(joinMeta(["3 votes", "2/3 confirmations", "Expires in 5h"])).toBe("3 votes · 2/3 confirmations · Expires in 5h");
  expect(joinMeta(["3 votes", null, ""])).toBe("3 votes");
  expect(joinMeta([null, null])).toBe("");
});
test("formatUntil returns null without an expiry", () => {
  expect(formatUntil(null, 1000, until)).toBeNull();
  expect(formatUntil(undefined, 1000, until)).toBeNull();
});

test("formatUntil reports expired and remaining time", () => {
  const now = 1700000000000;
  expect(formatUntil(now - 1000, now, until)).toBe("Expired");
  expect(formatUntil(now + 30 * 60000, now, until)).toBe("Expires in 30m");
  expect(formatUntil(now + 5 * 3600000, now, until)).toBe("Expires in 5h");
  expect(formatUntil(now + 3 * 86400000, now, until)).toBe("Expires in 3d");
});

test("flagOverlayActions maps confirm plus deny to footer actions", () => {
  const seen: string[] = [];
  const actions = flagOverlayActions(
    "f1",
    "1",
    false,
    false,
    false,
    false,
    {confirm: "Confirm", deny: "Deny", remove: "Remove"},
    {onConfirm: (id) => { seen.push(`confirm:${id}`); }, onDeny: (id) => { seen.push(`deny:${id}`); }, onRemove: (id) => { seen.push(`remove:${id}`); }},
  );
  expect(actions.map((a) => a.label)).toEqual(["Confirm", "Deny"]);
  expect(actions[0].tone).toBe("primary");
  expect(actions[0].outline).toBeUndefined();
  expect(actions[1].tone).toBe("danger");
  expect(actions[1].outline).toBe(true);
  actions[0].onPress();
  actions[1].onPress();
  expect(seen).toEqual(["confirm:f1", "deny:f1"]);
});

test("flagOverlayActions maps own suggested reports to a danger remove", () => {
  const actions = flagOverlayActions(
    "f2",
    "1",
    true,
    false,
    false,
    true,
    {confirm: "Confirm", deny: "Deny", remove: "Remove"},
    {onConfirm: () => undefined, onDeny: () => undefined, onRemove: () => undefined},
  );
  expect(actions.map((a) => a.label)).toEqual(["Remove"]);
  expect(actions[0].tone).toBe("danger");
  expect(actions[0].busy).toBe(true);
});

test("flagOverlayActions hides voted and denied actions and locks locked reports", () => {
  const voted = flagOverlayActions(
    "f3",
    "1",
    false,
    true,
    false,
    false,
    {confirm: "Confirm", deny: "Deny", remove: "Remove"},
    {onConfirm: () => undefined, onDeny: () => undefined, onRemove: () => undefined},
  );
  expect(voted.map((a) => a.label)).toEqual(["Deny"]);
  const denied = flagOverlayActions(
    "f3",
    "1",
    false,
    false,
    true,
    false,
    {confirm: "Confirm", deny: "Deny", remove: "Remove"},
    {onConfirm: () => undefined, onDeny: () => undefined, onRemove: () => undefined},
  );
  expect(denied.map((a) => a.label)).toEqual(["Confirm"]);
  const locked = flagOverlayActions(
    "f4",
    "3",
    true,
    false,
    false,
    false,
    {confirm: "Confirm", deny: "Deny", remove: "Remove"},
    {onConfirm: () => undefined, onDeny: () => undefined, onRemove: () => undefined},
  );
  expect(locked).toEqual([]);
});
