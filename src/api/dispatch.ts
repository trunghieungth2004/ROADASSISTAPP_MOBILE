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
  IN_SHOP: "10",
  FINAL_QUOTED: "11",
  RESOLVED_UNFIXABLE: "12",
  ESTIMATED: "13",
  EST_APPROVED: "14",
  UNFIXABLE: "15",
} as const;

export type DispatchStatusCode = (typeof DISPATCH_STATUS)[keyof typeof DISPATCH_STATUS];

export function isTerminal(status: string): boolean {
  return status === DISPATCH_STATUS.RESOLVED || status === DISPATCH_STATUS.CANCELLED || status === DISPATCH_STATUS.DECLINED || status === DISPATCH_STATUS.RESOLVED_UNFIXABLE;
}

export function isUnfixableStatus(status: string): boolean {
  return status === DISPATCH_STATUS.UNFIXABLE || status === DISPATCH_STATUS.RESOLVED_UNFIXABLE;
}

export type RiderAction = "arrived" | "resolved" | "cancel";

export type FeedDirection = "in" | "out";

export type FeedTicket = DispatchTicket & {
  direction: FeedDirection;
  otherParty?: {
    id: string;
    name: string;
    kind: string;
    lat?: number;
    lng?: number;
    label?: string;
    openNow?: boolean;
    ratingAvg?: number;
    ratingCount?: number;
    phone?: string;
  } | null;
  statusHistory?: {status: string; at: string; by: string}[];
  destinationParty?: {
    id: string;
    name: string;
    kind: string;
    lat?: number;
    lng?: number;
    label?: string;
    openNow?: boolean;
    ratingAvg?: number;
    ratingCount?: number;
    phone?: string;
  } | null;
  etaPickupAt?: string | null;
  etaDropoffAt?: string | null;
  towerFix?: {lat: number; lng: number; at: string} | null;
  linkedTicketIds?: string[];
};

export const DECLINE_REASONS = ["FULL", "CLOSED", "PARTS_DELAY", "OTHER"] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];

export function riderActionsFor(status: string): RiderAction[] {
  if (status === DISPATCH_STATUS.MATCHED) return ["arrived", "cancel"];
  if (status === DISPATCH_STATUS.ARRIVED || status === DISPATCH_STATUS.READY) return ["resolved", "cancel"];
  if (status === DISPATCH_STATUS.PENDING) return ["cancel"];
  return [];
}

export type TowFare = {
  estimate: number;
  ceiling: number;
  final?: number | null;
  partial?: boolean;
  deadheadKm: number;
  loadedKm: number;
  night: boolean;
  vehicleClass?: string | null;
  waitingFee?: number | null;
  waitingMinutes?: number | null;
};

export type DispatchTicket = {
  id: string;
  userId: string;
  riderName?: string | null;
  distance?: number;
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
  destinationSnapshot?: {id?: string; name?: string; lat: number; lng: number; kind?: string; label?: string | null; source?: string} | null;
  assignedUid?: string | null;
  assignedShopId?: string | null;
  assignedKind?: string | null;
  towPlate?: string | null;
  towFare?: TowFare | null;
  cancelledBy?: string | null;
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
  towLegs?: Array<{toShopId?: string; km?: number; actual?: boolean; at?: string}> | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  commission?: number | null;
  payout?: number | null;
  waitingFee?: number | null;
  unfixable?: boolean | null;
  description?: string | null;
  photoUrls?: string[] | null;
  estimateAmount?: number | null;
  estimateNote?: string | null;
  estimateStatus?: string | null;
  estimateExpiresAt?: string | null;
  estimateApprovedAt?: string | null;
  faultPhotos?: string[] | null;
  waitingMinutes?: number | null;
  waitingSince?: string | null;
  qrUrl?: string | null;
  checkoutUrl?: string | null;
  paymentId?: string | null;
  pickupHistory?: Array<{lat: number; lng: number; at: string}> | null;
  createdAt?: string;
};

export type CreateTicketPayload = {
  ticketType: TicketType;
  lat: number;
  lng: number;
  note?: string;
  description?: string;
  photoUrls?: string[];
  declinedShopIds?: string[];
  providerId?: string;
  destinationShopId?: string;
  destinationPoint?: {lat: number; lng: number; label?: string};
  vehicleType?: string;
  vehicleWidth?: number;
  vehicleLabel?: string;
  force?: boolean;
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

export function nearTickets(lat: number, lng: number, token: string, radiusMeters?: number, ticketType?: string): Promise<DispatchTicket[]> {
  const key = `ticketsNear:${token}:${lat.toFixed(3)},${lng.toFixed(3)},${radiusMeters ?? "-"},${ticketType ?? "-"}`;
  return withCache(key, CACHE_TTL_MS.ticketsNear, () => api.post<DispatchTicket[]>("/dispatch/near", {lat, lng, radiusMeters, ticketType}, token));
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

export {bustTicketCaches};

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

export async function sendEstimate(ticketId: string, estimateAmount: number, estimateNote: string | undefined, token: string): Promise<{estimated: boolean}> {
  const res = await api.post<{estimated: boolean}>("/dispatch/estimate", {ticketId, estimateAmount, ...(estimateNote ? {estimateNote} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function approveQuote(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/quote/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function declineDestination(ticketId: string, token: string): Promise<{declined: boolean; legKm: number}> {
  const res = await api.post<{declined: boolean; legKm: number}>("/dispatch/destination/decline", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function refreshTowEta(ticketId: string, token: string): Promise<{updated: number}> {
  const res = await api.post<{updated: number}>("/dispatch/eta/refresh", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function estimateTowFare(ticketId: string, lat: number, lng: number, token: string): Promise<TowFareQuote> {
  const res = await api.post<TowFareQuote>("/dispatch/fare/estimate", {ticketId, lat, lng}, token);
  return res;
}

export type TowFareQuote = {
  estimate: number;
  ceiling: number;
  deadheadKm: number;
  loadedKm: number;
  night: boolean;
  vehicleClass: string;
};

export async function updateTicketDestination(ticketId: string, dest: {destinationShopId?: string; destinationPoint?: {lat: number; lng: number; label?: string}}, token: string): Promise<DispatchTicket> {
  const res = await api.post<DispatchTicket>("/dispatch/destination", {ticketId, ...dest}, token);
  bustTicketCaches(token);
  return res;
}

export function shopRequests(shopId: string, token: string): Promise<DispatchTicket[]> {
  return api.post<DispatchTicket[]>("/dispatch/shop/requests", {shopId}, token);
}

export function shopRecords(shopId: string, limit: number | undefined, token: string): Promise<DispatchTicket[]> {
  return api.post<DispatchTicket[]>("/dispatch/shop/records", {shopId, limit}, token);
}

function haversineMeters(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(aa)));
}

export function effectivePickup(ticket: Pick<DispatchTicket, "lat" | "lng" | "pickupHistory">): {lat: number; lng: number} {
  const hist = Array.isArray(ticket.pickupHistory) ? ticket.pickupHistory : [];
  const last = hist.length > 0 ? hist[hist.length - 1] : null;
  if (last && typeof last.lat === "number" && typeof last.lng === "number") return {lat: last.lat, lng: last.lng};
  return {lat: ticket.lat, lng: ticket.lng};
}

export function riderMovedMeters(ticket: Pick<DispatchTicket, "lat" | "lng" | "pickupHistory">): number | null {
  const hist = Array.isArray(ticket.pickupHistory) ? ticket.pickupHistory : [];
  if (hist.length === 0) return null;
  const first = hist[0];
  if (!first || typeof first.lat !== "number" || typeof first.lng !== "number") return null;
  const current = effectivePickup(ticket);
  const moved = Math.round(haversineMeters({lat: first.lat, lng: first.lng}, current));
  if (!Number.isFinite(moved) || moved <= 0) return null;
  return moved;
}

export const RIDER_DISPUTE_REASONS = ["LATE", "OVERCHARGE", "NO_SHOW", "RUDE", "WRONG_ROUTE", "OTHER"] as const;

export type RiderDisputeReason = (typeof RIDER_DISPUTE_REASONS)[number];

export async function approveEstimate(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/estimate/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function declineEstimate(ticketId: string, token: string): Promise<{declined: boolean}> {
  const res = await api.post<{declined: boolean}>("/dispatch/estimate/decline", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function sendQuote(ticketId: string, quotedAmount: number, workType: string | undefined, token: string): Promise<{quoted: boolean}> {
  const res = await api.post<{quoted: boolean}>("/dispatch/quote", {ticketId, quotedAmount, ...(workType ? {workType} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function approveFinalQuote(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/quote/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function reportUnfixable(ticketId: string, reason: string, photoUrls: string[], token: string): Promise<{unfixable: boolean}> {
  const res = await api.post<{unfixable: boolean}>("/dispatch/unfixable", {ticketId, reason, photoUrls}, token);
  bustTicketCaches(token);
  return res;
}

export type FileDisputePayload = {
  ticketId: string;
  reason: string;
  note?: string;
  photoUrl?: string;
};

export async function fileDispute(payload: FileDisputePayload, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/disputes", payload, token);
}

export type TicketPayment = {
  id: string;
  ticketId: string;
  method: string;
  status: string;
  amount?: number | null;
  checkoutUrl?: string | null;
  waitingFee?: number | null;
  unfixable?: boolean | null;
};

type PaymentWire = TicketPayment & {checkout?: {qrUrl?: string | null} | null};

function toTicketPayment(raw: PaymentWire): TicketPayment {
  return {
    id: raw.id,
    ticketId: raw.ticketId,
    method: raw.method,
    status: raw.status,
    amount: typeof raw.amount === "number" ? raw.amount : null,
    checkoutUrl: typeof raw.checkout?.qrUrl === "string" && raw.checkout.qrUrl !== "" ? raw.checkout.qrUrl : null,
    waitingFee: typeof raw.waitingFee === "number" ? raw.waitingFee : null,
    unfixable: raw.unfixable === true ? true : null,
  };
}

export async function createPayment(ticketId: string, method: string, token: string): Promise<TicketPayment> {
  const res = await api.post<PaymentWire>("/payments/create", {ticketId, method}, token);
  return toTicketPayment(res);
}

export async function confirmCashReceipt(ticketId: string, token: string): Promise<TicketPayment> {
  const res = await api.post<PaymentWire>("/payments/confirm-cash", {ticketId}, token);
  return toTicketPayment(res);
}

export async function refreshWaiting(ticketId: string, token: string): Promise<{waitingMinutes: number; waitingFee: number}> {
  const res = await api.post<{active: boolean; elapsedSeconds: number; fee: number}>("/dispatch/waiting", {ticketId}, token);
  bustTicketCaches(token);
  return {waitingMinutes: Math.ceil(res.elapsedSeconds / 60), waitingFee: typeof res.fee === "number" ? res.fee : 0};
}
