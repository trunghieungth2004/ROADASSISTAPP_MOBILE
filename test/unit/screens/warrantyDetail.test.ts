import {expect, test} from "@jest/globals";
import type {VehicleHistoryItem, VehicleHistoryLine, VehicleProfile} from "../../../src/api/vehicles";
import type {WarrantyClaim} from "../../../src/api/warranty";
import {
  claimDetail,
  coverageDetail,
  coverageForClaim,
  groupClaimsByTicket,
  groupCoverageByTicket,
} from "../../../src/screens/warranty/warrantyDetail";

const profile = {
  id: "p1",
  type: "BIKE",
  baseWidth: 0.7,
  baseHeight: 1.1,
  label: "Honda Wave",
  plate: "59-X1 123.45",
} as VehicleProfile;

const provider = {
  id: "shop1",
  kind: "SHOP",
  name: "Fix Shop",
  lat: 10.7,
  lng: 106.6,
  label: "District 1",
  status: "ACTIVE",
} as never;

const line = {
  lineId: "l1",
  serviceCode: "TIRE",
  name: "Flat tire",
  category: "FLAT_TIRE",
  qty: 1,
  unitPrice: 100000,
  amount: 100000,
  warrantyDays: 30,
  warrantyParts: "PARTS_AND_LABOR",
  warrantyUntil: "2027-01-01T00:00:00.000Z",
  claim: null,
} as VehicleHistoryLine;

const item = {
  ticketId: "t1",
  ticketType: "WALK_IN",
  serviceDate: "2026-10-01T00:00:00.000Z",
  providerName: "Fix Shop",
  provider,
  total: 100000,
  lines: [line],
} as VehicleHistoryItem;

const claim = {
  id: "wc1",
  ticketId: "t1",
  lineId: "l1",
  serviceCode: "TIRE",
  serviceName: "Flat tire",
  category: "FLAT_TIRE",
  providerId: "shop1",
  providerName: "Fix Shop",
  provider,
  vehicleLabel: "Honda Wave",
  vehiclePlate: "59-X1 123.45",
  lineAmount: 100000,
  warrantyUntil: "2027-01-01T00:00:00.000Z",
  status: "OPEN",
  reason: "Patch failed",
  photoUrls: [],
  shopResponse: null,
  respondedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  linkedTicketId: null,
  refundAmount: null,
} as WarrantyClaim;

test("coverage details carry service, provider and warranty terms", () => {
  const detail = coverageDetail(
    {profile, item, line},
    claim,
  );
  expect(detail).toMatchObject({
    ticketId: "t1",
    lineId: "l1",
    serviceName: "Flat tire",
    category: "FLAT_TIRE",
    amount: 100000,
    qty: 1,
    unitPrice: 100000,
    warrantyDays: 30,
    warrantyParts: "PARTS_AND_LABOR",
    serviceDate: "2026-10-01T00:00:00.000Z",
    providerName: "Fix Shop",
    vehicleLabel: "Honda Wave",
    vehiclePlate: "59-X1 123.45",
    claim,
  });
});

test("claim details fall back to stored claim metadata", () => {
  const detail = claimDetail({
    ...claim,
    purchasedAt: "2026-10-02T00:00:00.000Z",
    serviceDate: "2026-10-03T00:00:00.000Z",
    qty: 1,
    unitPrice: 100000,
    warrantyDays: 30,
    warrantyParts: "PARTS_AND_LABOR",
  }, null);
  expect(detail).toMatchObject({
    purchaseDate: "2026-10-02T00:00:00.000Z",
    serviceDate: "2026-10-03T00:00:00.000Z",
    qty: 1,
    unitPrice: 100000,
    warrantyDays: 30,
    warrantyParts: "PARTS_AND_LABOR",
    providerName: "Fix Shop",
  });
});

test("matches a claim to its coverage row", () => {
  const row = {profile, item, line};
  expect(coverageForClaim([row], claim)).toBe(row);
  expect(coverageForClaim([row], {...claim, lineId: "other"})).toBeNull();
});

test("groups coverage by ticket while keeping per-line claims", () => {
  const second = {
    ...line,
    lineId: "l2",
    serviceCode: "OIL",
    name: "Oil change",
    amount: 80000,
    unitPrice: 80000,
    warrantyDays: 15,
  } as VehicleHistoryLine;
  const rows = [
    {profile, item, line},
    {profile, item, line: second},
  ];
  const groups = groupCoverageByTicket(rows, [claim]);
  expect(groups).toHaveLength(1);
  expect(groups[0].ticketId).toBe("t1");
  expect(groups[0].entries.map((entry) => entry.coverage.line.lineId))
    .toEqual(["l1", "l2"]);
  expect(groups[0].entries[0].claim?.id).toBe("wc1");
  expect(groups[0].entries[1].claim).toBeNull();
});

test("groups claims by ticket with provider and vehicle metadata", () => {
  const groups = groupClaimsByTicket([
    claim,
    {...claim, id: "wc2", lineId: "l2", serviceName: "Oil change"},
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({
    ticketId: "t1",
    providerName: "Fix Shop",
    vehicleLabel: "Honda Wave",
    vehiclePlate: "59-X1 123.45",
  });
  expect(groups[0].claims.map((row) => row.id)).toEqual(["wc1", "wc2"]);
});
