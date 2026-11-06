import {api} from "./client";

export type WarrantyClaim = {
  id: string;
  ticketId: string;
  lineId: string;
  serviceCode: string;
  serviceName: string;
  category?: string | null;
  providerId: string;
  vehicleLabel?: string | null;
  vehiclePlate?: string | null;
  lineAmount: number;
  status: string;
  reason: string;
  photoUrls: string[];
  shopResponse?: string | null;
  respondedAt?: string | null;
  warrantyUntil: string;
  createdAt: string;
  linkedTicketId: string | null;
  refundAmount: number | null;
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

export function respondWarrantyClaim(token: string, claimId: string, accept: boolean, note?: string): Promise<WarrantyClaim> {
  return api.post<WarrantyClaim>("/warranty/respond", {claimId, accept, ...(note ? {note} : {})}, token);
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
