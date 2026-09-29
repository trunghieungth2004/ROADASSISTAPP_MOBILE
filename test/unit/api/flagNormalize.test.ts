import {expect, test} from "@jest/globals";
import {FLAG_CONSENSUS_THRESHOLD, isExpired, toFlag} from "../../../src/api/flags";

function wire(overrides: Record<string, unknown>) {
  return {id: "f1", type: "FLOOD", lat: 10.76, lng: 106.66, status: "1", ...overrides} as Parameters<typeof toFlag>[0];
}

test("reporterUid maps to reporterId", () => {
  expect(toFlag(wire({reporterUid: "u1"})).reporterId).toBe("u1");
});

test("an explicit reporterId wins over reporterUid", () => {
  expect(toFlag(wire({reporterId: "u2", reporterUid: "u1"})).reporterId).toBe("u2");
});

test("a Firestore timestamp expiry becomes epoch millis", () => {
  expect(toFlag(wire({ttlExpiresAt: {_seconds: 1700000000, _nanoseconds: 500000000}})).ttlExpiresAtMs).toBe(1700000000500);
});

test("ISO and numeric expiries pass through, bad values become null", () => {
  expect(toFlag(wire({ttlExpiresAt: "2026-09-29T12:00:00.000Z"})).ttlExpiresAtMs).toBe(Date.parse("2026-09-29T12:00:00.000Z"));
  expect(toFlag(wire({ttlExpiresAt: 1700000000000})).ttlExpiresAtMs).toBe(1700000000000);
  expect(toFlag(wire({ttlExpiresAt: "nope"})).ttlExpiresAtMs).toBeNull();
  expect(toFlag(wire({})).ttlExpiresAtMs).toBeNull();
});

test("isExpired respects the TTL with missing values never expiring", () => {
  const now = 1700000000000;
  expect(isExpired({ttlExpiresAtMs: now - 1}, now)).toBe(true);
  expect(isExpired({ttlExpiresAtMs: now + 1000}, now)).toBe(false);
  expect(isExpired({ttlExpiresAtMs: null}, now)).toBe(false);
  expect(isExpired({}, now)).toBe(false);
});

test("the consensus threshold mirrors the backend", () => {
  expect(FLAG_CONSENSUS_THRESHOLD).toBe(3);
});
