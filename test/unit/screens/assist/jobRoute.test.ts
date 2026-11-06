import {describe, expect, it} from "@jest/globals";
import type {FeedTicket} from "../../../../src/api/dispatch";
import {jobRouteKeyFor} from "../../../../src/screens/assist/jobRoute";

const base = {
  id: "t1",
  userId: "u1",
  ticketType: "TOW",
  lat: 10.71,
  lng: 106.61,
  status: "2",
  direction: "out",
  destinationSnapshot: {id: "shop1", name: "Fix Shop", lat: 10.75, lng: 106.65, kind: "SHOP"},
} as FeedTicket;

describe("jobRouteKeyFor", () => {
  it("changes when the tower position becomes available", () => {
    const before = jobRouteKeyFor(base, null);
    const after = jobRouteKeyFor({...base, towerFix: {lat: 10.69, lng: 106.59, at: "2026-01-01T00:00:00.000Z"}}, null);
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  it("changes when the tower moves", () => {
    const first = jobRouteKeyFor({...base, towerFix: {lat: 10.69, lng: 106.59, at: "2026-01-01T00:00:00.000Z"}}, null);
    const second = jobRouteKeyFor({...base, towerFix: {lat: 10.7, lng: 106.6, at: "2026-01-01T00:01:00.000Z"}}, null);
    expect(second).not.toBe(first);
  });

  it("follows the tower's own position on an inbound tow", () => {
    const inbound = {...base, direction: "in", towerFix: null} as FeedTicket;
    const first = jobRouteKeyFor(inbound, null, {lat: 10.69, lng: 106.59});
    const second = jobRouteKeyFor(inbound, null, {lat: 10.7, lng: 106.6});
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("keeps the key stable while the tower is parked", () => {
    const inbound = {...base, direction: "in", towerFix: null} as FeedTicket;
    const first = jobRouteKeyFor(inbound, null, {lat: 10.6912, lng: 106.5912});
    const parked = jobRouteKeyFor(inbound, null, {lat: 10.6914, lng: 106.5914});
    expect(parked).toBe(first);
  });

  it("ignores the local position on the rider's outbound view", () => {
    const withFix = {...base, towerFix: {lat: 10.69, lng: 106.59, at: "2026-01-01T00:00:00.000Z"}} as FeedTicket;
    const first = jobRouteKeyFor(withFix, null, {lat: 1, lng: 2});
    const second = jobRouteKeyFor(withFix, null, {lat: 3, lng: 4});
    expect(second).toBe(first);
  });

  it("changes when the destination changes", () => {
    const first = jobRouteKeyFor(base, null);
    const second = jobRouteKeyFor({...base, destinationSnapshot: {id: "shop2", name: "Other", lat: 10.8, lng: 106.7, kind: "SHOP"}}, null);
    expect(second).not.toBe(first);
  });

  it("includes the mobile shop position for SOS", () => {
    const sos = {...base, ticketType: "SOS", assignedShopId: "mobile1"} as FeedTicket;
    const first = jobRouteKeyFor(sos, {lat: 10.68, lng: 106.58});
    const second = jobRouteKeyFor(sos, {lat: 10.69, lng: 106.59});
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("returns null for non-live tickets", () => {
    expect(jobRouteKeyFor({...base, status: "1"}, null)).toBeNull();
    expect(jobRouteKeyFor({...base, ticketType: "WALK_IN"}, null)).toBeNull();
  });
});
