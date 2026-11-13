import {api} from "./client";
import type {Provider} from "./providers";

export const WARRANTY_DECLINE_REASONS = [
  "NOT_COVERED",
  "WEAR_AND_TEAR",
  "EXPIRED",
  "WRONG_SERVICE",
  "MISUSE",
  "OTHER",
] as const;

export type WarrantyDeclineReason =
  (typeof WARRANTY_DECLINE_REASONS)[number];

export type WarrantyClaim = {
  id: string;
  ticketId: string;
  lineId: string;
  serviceCode: string;
  serviceName: string;
  category?: string | null;
  providerId: string;
  provider?: Provider | null;
  providerName?: string | null;
  vehicleId?: string | null;
  vehicleLabel?: string | null;
  vehiclePlate?: string | null;
  ticketType?: string | null;
  ticketStatus?: string | null;
  serviceDate?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineAmount: number;
  purchasedAt?: string | null;
  warrantyDays?: number | null;
  warrantyParts?: string | null;
  status: string;
  reason: string;
  photoUrls: string[];
  shopResponse?: string | null;
  declineReasonCode?: WarrantyDeclineReason | null;
  respondedAt?: string | null;
  disputeNote?: string | null;
  disputedAt?: string | null;
  warrantyUntil: string;
  createdAt: string;
  outcome?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  linkedTicketId: string | null;
  refundAmount: number | null;
  refundRequestId?: string | null;
};

export function fileWarrantyClaim(
  payload: {ticketId: string; lineId: string; reason: string; photoUrls?: string[]},
  token: string,
): Promise<WarrantyClaim> {
  return api.post<WarrantyClaim>("/warranty/claims", payload, token);
}

export function myWarrantyClaims(token: string, limit?: number): Promise<WarrantyClaim[]> {
  return api.post<WarrantyClaim[]>("/warranty/mine", typeof limit === "number" ? {limit} : {}, token);
}

export function shopWarrantyClaims(token: string, providerId?: string): Promise<WarrantyClaim[]> {
  return api.post<WarrantyClaim[]>("/warranty/shop", providerId ? {providerId} : {}, token);
}

export function respondWarrantyClaim(
  token: string,
  claimId: string,
  accept: boolean,
  options?: {reasonCode?: WarrantyDeclineReason; note?: string},
): Promise<WarrantyClaim> {
  return api.post<WarrantyClaim>("/warranty/respond", {
    claimId,
    accept,
    ...(options?.reasonCode ? {reasonCode: options.reasonCode} : {}),
    ...(options?.note ? {note: options.note} : {}),
  }, token);
}

export function disputeWarrantyClaim(
  token: string,
  claimId: string,
  note?: string,
): Promise<WarrantyClaim> {
  return api.post<WarrantyClaim>(
    "/warranty/dispute",
    {claimId, ...(note ? {note} : {})},
    token,
  );
}
