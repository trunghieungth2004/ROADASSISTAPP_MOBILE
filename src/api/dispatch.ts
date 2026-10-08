import {api} from "./client";
import {CACHE_TTL_MS, cacheClear, cacheDel, withCache} from "../services/cache";

export type TicketType = "SOS" | "TOW" | "MECHANIC" | "WALK_IN";

export const DISPATCH_STATUS = {
  PENDING: "1",
  MATCHED: "2",
  ARRIVED: "3",
  RESOLVED: "4",
  CANCELLED: "5",
  IN_PROGRESS: "6",
  READY: "7",
  DECLINED: "8",
  QUOTED: "9",
} as const;

export type DispatchStatusCode = (typeof DISPATCH_STATUS)[keyof typeof DISPATCH_STATUS];

export function isTerminal(status: string): boolean {
  return status === DISPATCH_STATUS.RESOLVED || status === DISPATCH_STATUS.CANCELLED || status === DISPATCH_STATUS.DECLINED;
}

export type RiderAction = "arrived" | "resolved" | "cancel";

export type FeedDirection = "in" | "out";

export type FeedTicket = DispatchTicket & {
  direction: FeedDirection;
  otherParty?: {
    id: string;
    name: string;
    kind: string;
    label?: string;
    openNow?: boolean;
    ratingAvg?: number;
    ratingCount?: number;
    phone?: string;
  } | null;
  statusHistory?: {status: string; at: string; by: string}[];
};

export const DECLINE_REASONS = ["FULL", "CLOSED", "PARTS_DELAY", "OTHER"] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];

export function riderActionsFor(status: string): RiderAction[] {
  if (status === DISPATCH_STATUS.MATCHED) return ["arrived", "cancel"];
  if (status === DISPATCH_STATUS.ARRIVED || status === DISPATCH_STATUS.READY) return ["resolved", "cancel"];
  if (status === DISPATCH_STATUS.PENDING) return ["cancel"];
  return [];
}

export type DispatchTicket = {
  id: string;
  userId: string;
  ticketType: string;
  lat: number;
  lng: number;
  note?: string | null;
  status: string;
  vehicleType?: string | null;
  vehicleWidth?: number | null;
  vehicleClass?: string | null;
  vehicleLabel?: string | null;
  providerId?: string | null;
  providerSnapshot?: {id: string; name: string; lat: number; lng: number; kind: string; closed?: boolean} | null;
  expiresAt?: string | null;
  destinationShopId?: string | null;
  destinationPoint?: {lat: number; lng: number; label?: string} | null;
  assignedUid?: string | null;
  assignedShopId?: string | null;
  assignedKind?: string | null;
  towPlate?: string | null;
  workType?: string | null;
  priceEstimate?: number | null;
  priceCurrency?: string | null;
  shopQuotedAmount?: number | null;
  quotedBy?: string | null;
  quotedAt?: string | null;
  finalAmount?: number | null;
  invoiceRef?: string | null;
  fulfilledByShopId?: string | null;
  declineReason?: string | null;
  declineNote?: string | null;
  createdAt?: string;
};

export type CreateTicketPayload = {
  ticketType: TicketType;
  lat: number;
  lng: number;
  note?: string;
  providerId?: string;
  destinationShopId?: string;
  destinationPoint?: {lat: number; lng: number; label?: string};
  vehicleType?: string;
  vehicleWidth?: number;
  vehicleLabel?: string;
};

export async function createTicket(payload: CreateTicketPayload, token: string): Promise<DispatchTicket> {
  const ticket = await api.post<DispatchTicket>("/dispatch", payload, token);
  bustTicketCaches(token);
  return ticket;
}

export function myTickets(token: string): Promise<DispatchTicket[]> {
  return withCache(`ticketsMine:${token}`, CACHE_TTL_MS.ticketsMine, () => api.post<DispatchTicket[]>("/dispatch/mine", {}, token));
}

export function feedTickets(limit: number | undefined, token: string): Promise<FeedTicket[]> {
  return withCache(`ticketsFeed:${token}`, CACHE_TTL_MS.ticketsMine, () => api.post<FeedTicket[]>("/dispatch/feed", {limit}, token));
}

export function getTicket(ticketId: string, token: string): Promise<DispatchTicket> {
  return api.post<DispatchTicket>("/dispatch/one", {ticketId}, token);
}

export async function cancelTicket(ticketId: string, token: string): Promise<{updated: number}> {
  const res = await api.put<{updated: number}>("/dispatch/status", {ticketId, status: "5"}, token);
  bustTicketCaches(token);
  return res;
}

export function nearTickets(lat: number, lng: number, token: string, radiusMeters?: number): Promise<DispatchTicket[]> {
  const key = `ticketsNear:${token}:${lat.toFixed(3)},${lng.toFixed(3)},${radiusMeters ?? "-"}`;
  return withCache(key, CACHE_TTL_MS.ticketsNear, () => api.post<DispatchTicket[]>("/dispatch/near", {lat, lng, radiusMeters}, token));
}

export async function acceptTicket(ticketId: string, token: string, shopId?: string): Promise<{matched: boolean; kind: string}> {
  const res = await api.post<{matched: boolean; kind: string}>("/dispatch/accept", {ticketId, shopId}, token);
  bustTicketCaches(token);
  return res;
}

export async function updateTicketStatus(ticketId: string, status: string, token: string): Promise<{updated: number}> {
  const res = await api.put<{updated: number}>("/dispatch/status", {ticketId, status}, token);
  bustTicketCaches(token);
  return res;
}

function bustTicketCaches(token: string): void {
  cacheDel(`ticketsMine:${token}`);
  cacheDel(`ticketsFeed:${token}`);
  cacheClear(`ticketsNear:${token}:`);
}

export async function declineTicket(ticketId: string, shopId: string, reason: string, note: string | undefined, token: string): Promise<{declined: boolean}> {
  const res = await api.post<{declined: boolean}>("/dispatch/decline", {ticketId, shopId, reason, note}, token);
  bustTicketCaches(token);
  return res;
}

export type WorkOrderPayload = {
  ticketId: string;
  workType?: string;
  quotedAmount?: number;
  finalAmount?: number;
  invoiceRef?: string;
};

export async function updateWorkOrder(payload: WorkOrderPayload, token: string): Promise<{updated: number}> {
  const res = await api.post<{updated: number}>("/dispatch/work", payload, token);
  bustTicketCaches(token);
  return res;
}

export async function sendQuote(ticketId: string, quotedAmount: number, workType: string | undefined, token: string): Promise<{quoted: boolean}> {
  const res = await api.post<{quoted: boolean}>("/dispatch/quote", {ticketId, quotedAmount, ...(workType ? {workType} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function approveQuote(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/quote/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export function shopRequests(shopId: string, token: string): Promise<DispatchTicket[]> {
  return api.post<DispatchTicket[]>("/dispatch/shop/requests", {shopId}, token);
}

export function shopRecords(shopId: string, limit: number | undefined, token: string): Promise<DispatchTicket[]> {
  return api.post<DispatchTicket[]>("/dispatch/shop/records", {shopId, limit}, token);
}
