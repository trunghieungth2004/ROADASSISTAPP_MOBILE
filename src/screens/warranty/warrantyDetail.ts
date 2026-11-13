import type {Provider} from "../../api/providers";
import type {
  VehicleHistoryItem,
  VehicleHistoryLine,
  VehicleProfile,
} from "../../api/vehicles";
import type {WarrantyClaim} from "../../api/warranty";

export type WarrantyCoverageRow = {
  profile: VehicleProfile;
  item: VehicleHistoryItem;
  line: VehicleHistoryLine;
};

export type WarrantyCoverageEntry = {
  coverage: WarrantyCoverageRow;
  claim: WarrantyClaim | null;
};

export type WarrantyCoverageGroup = {
  ticketId: string;
  profile: VehicleProfile;
  item: VehicleHistoryItem;
  entries: WarrantyCoverageEntry[];
};

export type WarrantyClaimGroup = {
  ticketId: string;
  providerName?: string | null;
  vehicleLabel?: string | null;
  vehiclePlate?: string | null;
  ticketType?: string | null;
  serviceDate?: string | null;
  claims: WarrantyClaim[];
};

export type WarrantyDetailInput = {
  ticketId: string;
  lineId: string;
  serviceName: string;
  serviceCode?: string | null;
  category?: string | null;
  amount: number;
  qty?: number | null;
  unitPrice?: number | null;
  warrantyUntil: string;
  warrantyDays?: number | null;
  warrantyParts?: string | null;
  serviceDate?: string | null;
  purchaseDate?: string | null;
  provider?: Provider | null;
  providerName?: string | null;
  vehicleLabel?: string | null;
  vehiclePlate?: string | null;
  profileLabel?: string | null;
  claim: WarrantyClaim | null;
};

const unitPriceOf = (
  amount: number,
  qty?: number | null,
  unitPrice?: number | null,
): number | null => {
  if (typeof unitPrice === "number") return unitPrice;
  if (typeof qty === "number" && qty > 0) return Math.round(amount / qty);
  return null;
};

export const coverageDetail = (
  row: WarrantyCoverageRow,
  claim: WarrantyClaim | null,
): WarrantyDetailInput => ({
  ticketId: row.item.ticketId,
  lineId: row.line.lineId,
  serviceName: row.line.name,
  serviceCode: row.line.serviceCode,
  category: row.line.category ?? claim?.category ?? null,
  amount: row.line.amount,
  qty: row.line.qty,
  unitPrice: unitPriceOf(
    row.line.amount,
    row.line.qty,
    row.line.unitPrice,
  ),
  warrantyUntil: row.line.warrantyUntil ?? claim?.warrantyUntil ?? "",
  warrantyDays: row.line.warrantyDays ?? claim?.warrantyDays ?? null,
  warrantyParts: row.line.warrantyParts ?? claim?.warrantyParts ?? null,
  serviceDate: row.item.serviceDate,
  purchaseDate: row.item.serviceDate,
  provider: row.item.provider ?? null,
  providerName: row.item.providerName ?? null,
  vehicleLabel: row.profile.label ?? claim?.vehicleLabel ?? null,
  vehiclePlate: row.profile.plate ?? claim?.vehiclePlate ?? null,
  profileLabel: row.profile.label ?? null,
  claim,
});

export const claimDetail = (
  claim: WarrantyClaim,
  coverage: WarrantyCoverageRow | null,
): WarrantyDetailInput => ({
  ticketId: claim.ticketId,
  lineId: claim.lineId,
  serviceName: claim.serviceName,
  serviceCode: claim.serviceCode,
  category: claim.category ?? coverage?.line.category ?? null,
  amount: claim.lineAmount,
  qty: claim.qty ?? coverage?.line.qty ?? null,
  unitPrice: unitPriceOf(
    claim.lineAmount,
    claim.qty ?? coverage?.line.qty,
    claim.unitPrice ?? coverage?.line.unitPrice,
  ),
  warrantyUntil: claim.warrantyUntil,
  warrantyDays: claim.warrantyDays ?? coverage?.line.warrantyDays ?? null,
  warrantyParts: claim.warrantyParts ?? coverage?.line.warrantyParts ?? null,
  serviceDate: claim.serviceDate ?? coverage?.item.serviceDate ?? null,
  purchaseDate: claim.purchasedAt ?? claim.serviceDate ??
    coverage?.item.serviceDate ?? null,
  provider: claim.provider ?? coverage?.item.provider ?? null,
  providerName: claim.providerName ?? coverage?.item.providerName ?? null,
  vehicleLabel: claim.vehicleLabel ?? coverage?.profile.label ?? null,
  vehiclePlate: claim.vehiclePlate ?? coverage?.profile.plate ?? null,
  profileLabel: coverage?.profile.label ?? null,
  claim,
});

export const coverageForClaim = (
  rows: WarrantyCoverageRow[],
  claim: WarrantyClaim,
): WarrantyCoverageRow | null =>
  rows.find((row) =>
    row.item.ticketId === claim.ticketId && row.line.lineId === claim.lineId
  ) ?? null;

export const groupCoverageByTicket = (
  rows: WarrantyCoverageRow[],
  claims: WarrantyClaim[],
): WarrantyCoverageGroup[] => {
  const claimByLine = new Map(claims.map((claim) => [claim.lineId, claim]));
  const groups = new Map<string, WarrantyCoverageGroup>();
  for (const coverage of rows) {
    const ticketId = coverage.item.ticketId;
    const group = groups.get(ticketId) ?? {
      ticketId,
      profile: coverage.profile,
      item: coverage.item,
      entries: [],
    };
    group.entries.push({
      coverage,
      claim: claimByLine.get(coverage.line.lineId) ?? null,
    });
    groups.set(ticketId, group);
  }
  return [...groups.values()];
};

export const groupClaimsByTicket = (
  claims: WarrantyClaim[],
): WarrantyClaimGroup[] => {
  const groups = new Map<string, WarrantyClaimGroup>();
  for (const claim of claims) {
    const group = groups.get(claim.ticketId) ?? {
      ticketId: claim.ticketId,
      providerName: claim.providerName ?? claim.provider?.name ?? null,
      vehicleLabel: claim.vehicleLabel ?? null,
      vehiclePlate: claim.vehiclePlate ?? null,
      ticketType: claim.ticketType ?? null,
      serviceDate: claim.serviceDate ?? claim.purchasedAt ?? null,
      claims: [],
    };
    group.claims.push(claim);
    groups.set(claim.ticketId, group);
  }
  return [...groups.values()];
};
