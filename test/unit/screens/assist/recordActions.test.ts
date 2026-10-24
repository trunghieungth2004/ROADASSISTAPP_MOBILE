import {expect, test} from "@jest/globals";
import {canAccept, canApproveQuote, canCancel, canDecline, canDeclineDestination, canDispute, canDisputeResolved, canEditDestination, canEditWork, canMarkReady, canMarkUnfixable, canRate, canRateRider, canSeeRequestPhotos, canSendEstimate, canSendQuote, canStartWork, estimateStateOf, retargetableLiveTicket, announcesShopPush, viewerRoleOf, visibleActions} from "../../../../src/screens/assist/recordActions";

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
  expect(canAccept({kind: "candidate", candidateKind: "SHOP"})).toBe(true);
  expect(canAccept({kind: "candidate", candidateKind: "TOW"})).toBe(true);
  expect(canDecline({kind: "candidate", candidateKind: "SHOP"})).toBe(true);
  expect(canDecline({kind: "candidate", candidateKind: "TOW"})).toBe(true);
  expect(canAccept({kind: "rider"})).toBe(false);
  expect(canDecline({kind: "rider"})).toBe(false);
  expect(canAccept({kind: "assigned", assignedKind: "SHOP"})).toBe(false);
  expect(canDecline({kind: "assigned", assignedKind: "TOW"})).toBe(false);
  expect(canAccept({kind: "destination"})).toBe(false);
  expect(canDecline({kind: "destination"})).toBe(false);
  expect(canAccept({kind: "other"})).toBe(false);
  expect(canDecline({kind: "other"})).toBe(false);
});

test("operator records work-done details on in-progress shop jobs", () => {
  for (const type of ["WALK_IN", "MECHANIC"]) {
    expect(canEditWork("in", "6", true, type)).toBe(true);
    expect(canEditWork("out", "6", true, type)).toBe(false);
    expect(canEditWork("in", "6", false, type)).toBe(false);
  }
  for (const s of ["1", "2", "3", "4", "5", "7", "8"]) expect(canEditWork("in", s, true, "WALK_IN")).toBe(false);
  for (const type of ["TOW", "SOS"]) expect(canEditWork("in", "6", true, type)).toBe(false);
});

test("operator rates the rider on resolved inbound jobs", () => {
  expect(canRateRider({kind: "assigned", assignedKind: "SHOP"}, "4")).toBe(true);
  expect(canRateRider({kind: "assigned", assignedKind: "TOW"}, "4")).toBe(true);
  expect(canRateRider({kind: "assigned", assignedKind: null}, "4")).toBe(true);
  for (const s of ["1", "2", "3", "5", "6", "7", "8"]) expect(canRateRider({kind: "assigned", assignedKind: "SHOP"}, s)).toBe(false);
  for (const role of [{kind: "rider"}, {kind: "destination"}, {kind: "other"}, {kind: "candidate", candidateKind: "TOW"}] as const) {
    expect(canRateRider(role, "4")).toBe(false);
  }
});

test("volunteers start arrived SOS jobs, shops quote first", () => {
  expect(canStartWork("in", "3", "SOS", false, true)).toBe(true);
  expect(canStartWork("in", "2", "SOS", false, true)).toBe(false);
  expect(canStartWork("in", "3", "WALK_IN", false, true)).toBe(false);
  expect(canStartWork("in", "2", "WALK_IN", false, true)).toBe(false);
  expect(canStartWork("out", "3", "SOS", false, true)).toBe(false);
  expect(canStartWork("in", "3", "SOS", false, false)).toBe(false);
  expect(canStartWork("in", "3", "SOS", true, true)).toBe(false);
  expect(canMarkReady("in", "6", "WALK_IN", true)).toBe(true);
  expect(canMarkReady("in", "6", "MECHANIC", true)).toBe(true);
  expect(canMarkReady("in", "6", "TOW", true)).toBe(false);
  expect(canMarkReady("in", "2", "WALK_IN", true)).toBe(false);
  expect(canMarkReady("in", "6", "WALK_IN", false)).toBe(false);
  expect(canMarkReady("out", "6", "WALK_IN", true)).toBe(false);
});

test("unfixable runs from live shop states", () => {
  for (const s of ["2", "3", "6", "9", "10", "11"]) expect(canMarkUnfixable("WALK_IN", s)).toBe(true);
  for (const s of ["1", "4", "7", "8", "12", "15"]) expect(canMarkUnfixable("WALK_IN", s)).toBe(false);
  expect(canMarkUnfixable("TOW", "3")).toBe(false);
  expect(canMarkUnfixable("SOS", "2")).toBe(true);
  expect(canMarkUnfixable("SOS", "3")).toBe(true);
  expect(canMarkUnfixable("SOS", "6")).toBe(false);
});

test("destination decline belongs to the destination shop from pending on", () => {
  expect(canDeclineDestination("1", true)).toBe(true);
  expect(canDeclineDestination("2", true)).toBe(true);
  for (const s of ["3", "6", "7"]) expect(canDeclineDestination(s, true)).toBe(true);
  for (const s of ["4", "5", "8"]) expect(canDeclineDestination(s, true)).toBe(false);
  for (const s of ["1", "2", "3", "6", "7"]) expect(canDeclineDestination(s, false)).toBe(false);
});

test("drop-off edit belongs to the rider on editable tow tickets", () => {
  for (const s of ["1", "2", "3"]) expect(canEditDestination("out", s, "TOW")).toBe(true);
  for (const s of ["4", "5", "8", "6", "7", "9"]) expect(canEditDestination("out", s, "TOW")).toBe(false);
  expect(canEditDestination("in", "1", "TOW")).toBe(false);
  expect(canEditDestination("out", "1", "WALK_IN")).toBe(false);
  expect(canEditDestination("out", "1", "SOS")).toBe(false);
});

test("retarget shortcut needs a destination-less editable tow", () => {
  const row = (overrides?: object) => ({
    id: "t6",
    ticketType: "TOW",
    status: "1",
    direction: "out",
    lat: 10.71,
    lng: 106.61,
    ...overrides,
  }) as Parameters<typeof retargetableLiveTicket>[0][number];
  const feed = [row()];
  expect(retargetableLiveTicket(feed, "t6")).toBe(feed[0]);
  expect(retargetableLiveTicket(feed, "missing")).toBeNull();
  expect(retargetableLiveTicket([row({direction: "in"})], "t6")).toBeNull();
  expect(retargetableLiveTicket([row({status: "4"})], "t6")).toBeNull();
  expect(retargetableLiveTicket([row({ticketType: "SOS"})], "t6")).toBeNull();
  expect(retargetableLiveTicket([row({destinationSnapshot: {lat: 10.75, lng: 106.65}})], "t6")).toBeNull();
});

test("shop-addressed pushes announce, board copies stay quiet", () => {
  const mine = new Set(["shop-1"]);
  const row = (overrides?: object) => ({
    id: "t6",
    ticketType: "TOW",
    status: "1",
    direction: "in",
    lat: 10.71,
    lng: 106.61,
    ...overrides,
  }) as Parameters<typeof announcesShopPush>[0][number];
  expect(announcesShopPush([row({destinationShopId: "shop-1"})], mine, "t6")).toBe(true);
  expect(announcesShopPush([row({providerId: "shop-1"})], mine, "t6")).toBe(true);
  expect(announcesShopPush([row({destinationShopId: "shop-2"})], mine, "t6")).toBe(false);
  expect(announcesShopPush([row({destinationShopId: "shop-1", direction: "out"})], mine, "t6")).toBe(false);
  expect(announcesShopPush([row({destinationShopId: "shop-1", status: "2"})], mine, "t6")).toBe(false);
  expect(announcesShopPush([row({destinationShopId: "shop-1"})], mine, "missing")).toBe(false);
  expect(announcesShopPush([], mine, "t6")).toBe(false);
});

test("quote handshake gates both sides", () => {
  expect(canSendQuote("in", "2", "WALK_IN", true)).toBe(true);
  expect(canSendQuote("in", "3", "MECHANIC", true)).toBe(true);
  expect(canSendQuote("in", "10", "WALK_IN", true)).toBe(true);
  expect(canSendQuote("in", "6", "WALK_IN", true)).toBe(false);
  expect(canSendQuote("in", "2", "TOW", true)).toBe(false);
  expect(canSendQuote("in", "2", "WALK_IN", false)).toBe(false);
  expect(canSendQuote("out", "2", "WALK_IN", true)).toBe(false);
  expect(canApproveQuote("out", "9")).toBe(true);
  expect(canApproveQuote("out", "2")).toBe(false);
  expect(canApproveQuote("in", "9")).toBe(false);
  expect(canCancel("9")).toBe(true);
});

test("dispute opens after dispatch on live tickets", () => {
  expect(canDispute("1")).toBe(false);
  for (const s of ["2", "3", "6", "7", "9", "10", "11", "13", "14", "15"]) expect(canDispute(s)).toBe(true);
  for (const s of ["4", "5", "8", "12"]) expect(canDispute(s)).toBe(false);
});

test("resolved disputes stay open for a week on money tickets", () => {
  const now = Date.parse("2026-10-18T12:00:00.000Z");
  const within = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const edge = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stale = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
  const row = (overrides?: object) => ({
    status: "4",
    towFare: {estimate: 200000, ceiling: 300000, deadheadKm: 2, loadedKm: 5, night: false},
    statusHistory: [{status: "4", at: within, by: "u1"}],
    ...overrides,
  }) as Parameters<typeof canDisputeResolved>[0];
  expect(canDisputeResolved(row(), now)).toBe(true);
  expect(canDisputeResolved(row({statusHistory: [{status: "4", at: edge, by: "u1"}]}), now)).toBe(true);
  expect(canDisputeResolved(row({statusHistory: [{status: "4", at: stale, by: "u1"}]}), now)).toBe(false);
  expect(canDisputeResolved(row({towFare: null}), now)).toBe(false);
  expect(canDisputeResolved(row({towFare: null, shopQuotedAmount: 150000}), now)).toBe(true);
  expect(canDisputeResolved(row({status: "3"}), now)).toBe(false);
  expect(canDisputeResolved(row({statusHistory: undefined}), now)).toBe(true);
  expect(canDisputeResolved(row({statusHistory: [{status: "4", at: "not-a-date", by: "u1"}]}), now)).toBe(true);
});

test("estimate state tracks approval and expiry", () => {
  const now = Date.parse("2026-10-18T12:00:00.000Z");
  const future = new Date(now + 60 * 60 * 1000).toISOString();
  const past = new Date(now - 60 * 60 * 1000).toISOString();
  const row = (overrides?: object) => ({estimateAmount: 150000, ...overrides}) as Parameters<typeof estimateStateOf>[0];
  expect(estimateStateOf({}, now)).toBe("none");
  expect(estimateStateOf({estimateAmount: null}, now)).toBe("none");
  expect(estimateStateOf(row(), now)).toBe("pending");
  expect(estimateStateOf(row({estimateExpiresAt: future}), now)).toBe("pending");
  expect(estimateStateOf(row({estimateExpiresAt: past}), now)).toBe("expired");
  expect(estimateStateOf(row({estimateApprovedAt: past}), now)).toBe("approved");
  expect(estimateStateOf(row({estimateApprovedAt: past, estimateExpiresAt: past}), now)).toBe("approved");
});

test("destination shop sends tow estimates until one is live", () => {
  expect(canSendEstimate("in", "TOW", "1", true, "none")).toBe(true);
  expect(canSendEstimate("in", "TOW", "2", true, "none")).toBe(true);
  expect(canSendEstimate("in", "TOW", "3", true, "none")).toBe(true);
  expect(canSendEstimate("in", "TOW", "1", true, "expired")).toBe(true);
  expect(canSendEstimate("in", "TOW", "1", true, "pending")).toBe(false);
  expect(canSendEstimate("in", "TOW", "1", true, "approved")).toBe(false);
  for (const s of ["4", "5", "6", "7", "8", "9", "10", "11", "12"]) expect(canSendEstimate("in", "TOW", s, true, "none")).toBe(false);
  expect(canSendEstimate("in", "TOW", "1", false, "none")).toBe(false);
  expect(canSendEstimate("out", "TOW", "1", true, "none")).toBe(false);
  expect(canSendEstimate("in", "WALK_IN", "1", true, "none")).toBe(false);
  expect(canSendEstimate("in", "SOS", "1", true, "none")).toBe(false);
});

test("request photos follow the viewer gate", () => {
  const mine = new Set(["shop-1"]);
  const row = (overrides?: object) => ({
    direction: "in",
    assignedShopId: null,
    providerId: null,
    destinationShopId: null,
    assignedUid: null,
    ...overrides,
  }) as Parameters<typeof canSeeRequestPhotos>[0];
  expect(canSeeRequestPhotos(row({direction: "out"}), mine, "u1", false)).toBe(true);
  expect(canSeeRequestPhotos(row({assignedShopId: "shop-1"}), mine, "u1", false)).toBe(true);
  expect(canSeeRequestPhotos(row({providerId: "shop-1"}), mine, "u1", false)).toBe(true);
  expect(canSeeRequestPhotos(row({destinationShopId: "shop-1"}), mine, "u1", false)).toBe(true);
  expect(canSeeRequestPhotos(row({assignedShopId: "shop-2"}), mine, "u1", false)).toBe(false);
  expect(canSeeRequestPhotos(row({assignedUid: "u1"}), mine, "u1", true)).toBe(true);
  expect(canSeeRequestPhotos(row({assignedUid: "u1"}), mine, "u1", false)).toBe(false);
  expect(canSeeRequestPhotos(row({assignedUid: "u2"}), mine, "u1", true)).toBe(false);
  expect(canSeeRequestPhotos(row({assignedUid: "u1"}), mine, null, true)).toBe(false);
});

test("viewer role resolves one owner per ticket", () => {
  const scope = (overrides?: object) => ({
    ownShopIds: new Set(["shop-c"]),
    ownTowId: null as string | null,
    uid: "u1",
    hasVolunteer: false,
    ...overrides,
  });
  const row = (overrides?: object) => ({
    direction: "in",
    status: "2",
    ticketType: "TOW",
    assignedShopId: null,
    providerId: null,
    destinationShopId: "shop-c",
    assignedUid: null,
    ...overrides,
  }) as Parameters<typeof viewerRoleOf>[0];
  expect(viewerRoleOf(row({direction: "out"}), scope())).toEqual({kind: "rider"});
  expect(viewerRoleOf(row({assignedShopId: "shop-c"}), scope())).toEqual({kind: "assigned", assignedKind: "SHOP"});
  expect(viewerRoleOf(row({assignedShopId: "tow-b"}), scope({ownTowId: "tow-b"}))).toEqual({kind: "assigned", assignedKind: "TOW"});
  expect(viewerRoleOf(row({assignedShopId: "tow-b"}), scope({ownShopIds: new Set(["shop-c"]), ownTowId: "tow-b"}))).toEqual({kind: "assigned", assignedKind: "TOW"});
  expect(viewerRoleOf(row({assignedUid: "u1"}), scope({hasVolunteer: true}))).toEqual({kind: "assigned", assignedKind: null});
  expect(viewerRoleOf(row({assignedUid: "u1"}), scope())).toEqual({kind: "destination"});
  expect(viewerRoleOf(row({status: "1", providerId: "shop-c", destinationShopId: null}), scope())).toEqual({kind: "candidate", candidateKind: "SHOP"});
  expect(viewerRoleOf(row({status: "1", assignedShopId: "shop-c", providerId: "shop-c", destinationShopId: null}), scope())).toEqual({kind: "assigned", assignedKind: "SHOP"});
  expect(viewerRoleOf(row({status: "1", destinationShopId: null}), scope({ownTowId: "tow-b"}))).toEqual({kind: "candidate", candidateKind: "TOW"});
  expect(viewerRoleOf(row({status: "1", destinationShopId: null}), scope())).toEqual({kind: "other"});
  expect(viewerRoleOf(row({assignedShopId: "tow-b"}), scope())).toEqual({kind: "destination"});
  expect(viewerRoleOf(row({assignedShopId: "tow-b", destinationShopId: "shop-z"}), scope())).toEqual({kind: "other"});
});
