import {api} from "./client";
import type {ProviderService} from "./providers";
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
  return status === DISPATCH_STATUS.RESOLVED || status === DISPATCH_STATUS.CANCELLED || status === DISPATCH_STATUS.DECLINED || status === DISPATCH_STATUS.RESOLVED_UNFIXABLE || status === DISPATCH_STATUS.UNFIXABLE;
}

export function isUnfixableStatus(status: string): boolean {
  return status === DISPATCH_STATUS.UNFIXABLE || status === DISPATCH_STATUS.RESOLVED_UNFIXABLE;
}

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
    services?: ProviderService[] | null;
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
    services?: ProviderService[] | null;
  } | null;
  etaPickupAt?: string | null;
  etaDropoffAt?: string | null;
  towerFix?: {lat: number; lng: number; at: string} | null;
  mobileShopFix?: {lat: number; lng: number; at: string} | null;
  linkedTicketIds?: string[];
  canConfirmCash?: boolean;
  mobileTowOffer?: {
    status: string;
    shopId: string;
    destinationShopId: string | null;
    mode?: string;
    towProviderId?: string | null;
    by: string;
    at: string;
    expiresAt?: string | null;
  } | null;
  returnTowOffer?: {status: string; shopId: string; by: string; at: string} | null;
  mobileTowAvailable?: boolean;
  mobileTowMode?: "DIRECT" | "NETWORK";
  mobileTowState?: "DIRECT" | "TOW_OFF_DUTY" | "TOW_BUSY" | "NO_TOW" | "NONE_NEARBY";
  sosCallOutTotal?: number;
  linkedSummary?: {
    ticketId: string;
    ticketType: string;
    evidencePhotoUrls: string[];
    unfixableReason: string | null;
    sosAttempt: number;
    createdAt: string | null;
  } | null;
};

export const DECLINE_REASONS = ["FULL", "CLOSED", "PARTS_DELAY", "OTHER"] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];

export type TowFare = {
  estimate: number;
  ceiling: number;
  final?: number | null;
  partial?: boolean;
  deadheadKm: number;
  loadedKm: number;
  night: boolean;
  nightMultiplier?: number | null;
  vehicleClass?: string | null;
  baseFee?: number | null;
  perKmFee?: number | null;
  includedKm?: number | null;
  billableKm?: number | null;
  waitingFee?: number | null;
  waitingMinutes?: number | null;
};

export type WorkItem = {
  name: string;
  qty: number;
  unitPrice: number;
  amount?: number;
  kind?: string;
  serviceCode?: string;
  note?: string;
  listPrice?: number;
  warrantyDays?: number;
  warrantyUntil?: string | null;
};

export type DispatchTicket = {
  id: string;
  userId: string;
  riderName?: string | null;
  riderParty?: {
    id: string;
    name: string;
    kind: string;
    phone?: string;
    ratingAvg?: number;
    ratingCount?: number;
  } | null;
  distance?: number;
  ticketType: string;
  lat: number;
  lng: number;
  note?: string | null;
  symptom?: string | null;
  status: string;
  vehicleId?: string | null;
  vehicleType?: string | null;
  vehicleWidth?: number | null;
  vehicleClass?: string | null;
  vehicleLabel?: string | null;
  vehiclePlate?: string | null;
  vehicleHeight?: number | null;
  providerId?: string | null;
  providerSnapshot?: {id: string; name: string; lat: number; lng: number; kind: string; closed?: boolean} | null;
  expiresAt?: string | null;
  destinationShopId?: string | null;
  destinationPoint?: {lat: number; lng: number; label?: string} | null;
  destinationDecline?: {
    shopId: string;
    reasonCode: string;
    by: string;
    at: string;
  } | null;
  destinationSnapshot?: {id?: string; name?: string; lat: number; lng: number; kind?: string; label?: string | null; source?: string} | null;
  assignedUid?: string | null;
  assignedShopId?: string | null;
  formerAssignedShopIds?: string[];
  towCancelHistory?: Array<{
    shopId: string;
    by: string;
    at: string;
    reasonCode?: string;
  }>;
  formerAssignment?: boolean;
  formerAssignmentAt?: string | null;
  formerAssignmentKind?: "TOW" | "MOBILE_SHOP";
  formerAssignmentReason?: "TOWER_CANCEL" | "RIDER_DECLINED_FIX" | null;
  needsNewDestination?: boolean | null;
  assignedKind?: string | null;
  assignedAt?: string | null;
  loadedAt?: string | null;
  towKind?: "NORMAL" | "RETURN" | null;
  deliveredAt?: string | null;
  deliveredBy?: string | null;
  receivedAt?: string | null;
  towPlate?: string | null;
  towFare?: TowFare | null;
  cancelledBy?: string | null;
  workType?: string | null;
  quoteItems?: WorkItem[] | null;
  invoiceItems?: WorkItem[] | null;
  quoteVersion?: number;
  invoiceAmount?: number | null;
  invoiceApproval?: string | null;
  invoiceVersion?: number;
  invoiceApprovedAt?: string | null;
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
  hold?: {
    reason: string;
    note?: string | null;
    etaAt?: string | null;
    by: string;
    at: string;
  } | null;
  loadedPhotos?: string[];
  receivedPhotos?: string[];
  unfixable?: boolean | {reason?: string; photoUrls?: string[]; by?: string; at?: string} | null;
  sosAttempt?: number;
  bookingId?: string | null;
  warrantyOfTicketId?: string | null;
  warrantyClaimId?: string | null;
  acceptByAt?: string | null;
  dispatchRound?: number | null;
  dispatchRadiusMeters?: number | null;
  slaBreachedAt?: string | null;
  continuedFromTicketId?: string | null;
  continuationTicketId?: string | null;
  sourceTicketId?: string | null;
  mobileCallOutFee?: number | null;
  mobileCallOutWaived?: boolean | null;
  mobileTravelFee?: number | null;
  mobileTravelKm?: number | null;
  mobileTravelRate?: number | null;
  mobileFeeHistory?: Array<{
    shopId: string;
    shopName?: string | null;
    callOutFee: number;
    travelFee: number;
    waived: boolean;
    fixAmount?: number | null;
    items?: WorkItem[];
    declinedAt: string;
    reason?: string | null;
  }>;
  mobileFixApprovedAt?: string | null;
  mobileFixDeclinedAt?: string | null;
  mobileFixDeclineReason?: string | null;
  quoteDeclinedAt?: string | null;
  quoteDeclineReason?: string | null;
  towFeeHistory?: Array<{
    shopId: string;
    shopName?: string | null;
    amount: number;
    deadheadKm: number;
    loadedKm: number;
    at: string;
    reasonCode?: string | null;
  }>;
  towFeeCap?: number | null;
  chatVersion?: number;
  chatHistory?: Array<{
    version: number;
    roomId: string;
    shopId: string;
    shopName?: string | null;
    at: string;
  }>;
  disputeHold?: boolean | null;
  openDisputeId?: string | null;
  dispute?: {
    id: string;
    status: string;
    type: string;
    reasonCode: string;
    filedBy: string;
    filedByRole?: string | null;
    accusedKind: string;
    accusedId: string | null;
    hold: boolean;
    note?: string | null;
    photoUrls?: string[];
    outcome?: string | null;
    resolution?: string | null;
    at: string;
    resolvedAt?: string | null;
  } | null;
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
  symptom?: string;
  description?: string;
  photoUrls?: string[];
  declinedShopIds?: string[];
  providerId?: string;
  destinationShopId?: string;
  destinationPoint?: {lat: number; lng: number; label?: string};
  vehicleId?: string;
  vehicleType?: string;
  vehicleWidth?: number;
  vehicleLabel?: string;
  vehiclePlate?: string;
};

export async function createTicket(payload: CreateTicketPayload, token: string): Promise<DispatchTicket> {
  const ticket = await api.post<DispatchTicket>("/dispatch", payload, token);
  bustTicketCaches(token);
  return ticket;
}

export function myTickets(token: string): Promise<DispatchTicket[]> {
  return withCache(`ticketsMine:${token}`, CACHE_TTL_MS.ticketsMine, () => api.post<DispatchTicket[]>("/dispatch/mine", {}, token));
}

export function feedTickets(limit: number | undefined, token: string, fresh = false): Promise<FeedTicket[]> {
  const key = `ticketsFeed:${token}`;
  if (fresh) cacheDel(key);
  return withCache(key, CACHE_TTL_MS.ticketsMine, () => api.post<FeedTicket[]>("/dispatch/feed", {limit}, token));
}

export function getTicket(ticketId: string, token: string): Promise<DispatchTicket> {
  return api.post<DispatchTicket>("/dispatch/one", {ticketId}, token);
}

export async function cancelTicket(ticketId: string, token: string, reasonCode?: string): Promise<{updated: number}> {
  const res = await api.put<{updated: number}>("/dispatch/status", {ticketId, status: "5", ...(reasonCode ? {reasonCode} : {})}, token);
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
  cacheClear(`billsPayee:${token}:`);
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
  warrantyDays?: number;
  items?: Array<Pick<WorkItem, "name" | "qty" | "unitPrice" | "serviceCode">>;
};

export function quickFix(ticketId: string, items: Array<{name: string; qty: number; unitPrice: number}>, token: string): Promise<{quickFix: boolean; amount: number}> {
  const call = api.post<{quickFix: boolean; amount: number}>("/dispatch/quick-fix", {ticketId, items}, token);
  bustTicketCaches(token);
  return call;
}

export function releaseTicket(ticketId: string, reason: string | undefined, token: string): Promise<{released: boolean}> {
  const call = api.post<{released: boolean}>("/dispatch/release", {ticketId, ...(reason ? {reason} : {})}, token);
  bustTicketCaches(token);
  return call;
}

export function beatShareLocation(ticketId: string, lat: number, lng: number, token: string): Promise<{recorded: boolean}> {
  return api.post<{recorded: boolean}>("/dispatch/share/beat", {ticketId, lat, lng}, token);
}

export function shareTicket(ticketId: string, token: string): Promise<{token: string; expiresAt: string}> {
  return api.post<{token: string; expiresAt: string}>("/dispatch/share", {ticketId}, token);
}

export async function updateWorkOrder(payload: WorkOrderPayload, token: string): Promise<{updated: number}> {
  const res = await api.post<{updated: number}>("/dispatch/work", payload, token);
  bustTicketCaches(token);
  return res;
}

export async function approveInvoice(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/invoice/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function approveMobileFix(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/mobile-shop/fix/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function declineMobileFix(ticketId: string, reason: string | undefined, token: string): Promise<{declined: boolean}> {
  const res = await api.post<{declined: boolean}>("/dispatch/mobile-shop/fix/decline", {ticketId, ...(reason ? {reason} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function changeMobileShop(ticketId: string, reason: string | undefined, token: string): Promise<{changed: boolean; requeued: boolean; noCandidates: boolean}> {
  const res = await api.post<{changed: boolean; requeued: boolean; noCandidates: boolean}>("/dispatch/mobile-shop/change", {ticketId, ...(reason ? {reason} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function declineQuote(ticketId: string, reason: string | undefined, token: string): Promise<{declined: boolean; status: string}> {
  const res = await api.post<{declined: boolean; status: string}>("/dispatch/quote/decline", {ticketId, ...(reason ? {reason} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function setDispatchHold(
  ticketId: string,
  reason: "PARTS" | "RIDER_UNREACHABLE" | "ACCESS" | "WEATHER" | "TRAFFIC" | "OTHER",
  token: string,
  note?: string,
  etaAt?: string,
): Promise<DispatchTicket> {
  const res = await api.post<DispatchTicket>("/dispatch/hold", {
    ticketId,
    reason,
    ...(note ? {note} : {}),
    ...(etaAt ? {etaAt} : {}),
  }, token);
  bustTicketCaches(token);
  return res;
}

export async function clearDispatchHold(ticketId: string, token: string): Promise<DispatchTicket> {
  const res = await api.post<DispatchTicket>("/dispatch/hold/clear", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function markTowLoaded(ticketId: string, token: string, photoUrls?: string[]): Promise<{loaded: boolean}> {
  const res = await api.post<{loaded: boolean}>("/dispatch/tow/loaded", {ticketId, ...(photoUrls && photoUrls.length > 0 ? {photoUrls} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function confirmTowReceived(ticketId: string, token: string, photoUrls?: string[]): Promise<{received: boolean}> {
  const res = await api.post<{received: boolean}>("/dispatch/tow/received", {ticketId, ...(photoUrls && photoUrls.length > 0 ? {photoUrls} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function cancelTowerSearch(ticketId: string, reasonCode: string, token: string, lat?: number, lng?: number): Promise<{updated: number; requeued?: boolean}> {
  const res = await api.post<{updated: number; requeued?: boolean}>("/dispatch/tower/cancel", {ticketId, reasonCode, ...(lat !== undefined ? {lat} : {}), ...(lng !== undefined ? {lng} : {})}, token);
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

export async function declineDestination(ticketId: string, reasonCode: string, token: string): Promise<{declined: boolean; legKm: number}> {
  const res = await api.post<{declined: boolean; legKm: number}>("/dispatch/destination/decline", {ticketId, reasonCode}, token);
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
  baseFee?: number;
  perKmFee?: number;
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

export const RIDER_DISPUTE_REASONS = [
  "OVERCHARGE",
  "FIX_NOT_DONE",
  "POOR_QUALITY",
  "UNFIXABLE_DISAGREE",
] as const;

export type RiderDisputeReason = (typeof RIDER_DISPUTE_REASONS)[number];

export const PROVIDER_DISPUTE_REASONS = [
  "RIDER_REFUSED_PAYMENT",
] as const;

export type ProviderDisputeReason = (typeof PROVIDER_DISPUTE_REASONS)[number];

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

export async function sendQuote(ticketId: string, quotedAmount: number, workType: string | undefined, token: string, items?: Array<Pick<WorkItem, "name" | "qty" | "unitPrice" | "serviceCode">>): Promise<{quoted: boolean; version?: number}> {
  const res = await api.post<{quoted: boolean; version?: number}>("/dispatch/quote", {ticketId, quotedAmount, ...(workType ? {workType} : {}), ...(items && items.length > 0 ? {items} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function approveFinalQuote(ticketId: string, token: string): Promise<{approved: boolean}> {
  const res = await api.post<{approved: boolean}>("/dispatch/quote/approve", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function offerMobileShopTow(ticketId: string, destinationShopId: string | undefined, token: string): Promise<{offered: boolean; expiresAt?: string; mode?: "DIRECT" | "NETWORK"}> {
  const res = await api.post<{offered: boolean; expiresAt?: string; mode?: "DIRECT" | "NETWORK"}>("/dispatch/mobile-shop/tow-offer", {ticketId, ...(destinationShopId ? {destinationShopId} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export type MobileTowResponse = {
  accepted: boolean;
  ticketId?: string;
  network?: boolean;
  continuationTicketId?: string;
  requiresContinuationConfirmation?: boolean;
  noCandidates?: boolean;
  nextAttempt?: number;
  callOutTotal?: number;
  attempt?: number;
};

export async function respondMobileShopTow(ticketId: string, accept: boolean, token: string, destination?: {destinationShopId?: string; destinationPoint?: {lat: number; lng: number; label?: string}}): Promise<MobileTowResponse> {
  const res = await api.post<MobileTowResponse>("/dispatch/mobile-shop/tow-offer/respond", {
    ticketId,
    accept,
    ...(destination?.destinationShopId ? {destinationShopId: destination.destinationShopId} : {}),
    ...(destination?.destinationPoint ? {destinationPoint: destination.destinationPoint} : {}),
  }, token);
  bustTicketCaches(token);
  return res;
}

export async function continueSos(ticketId: string, token: string): Promise<{ticketId?: string; attempt?: number; callOutTotal?: number; noCandidates?: boolean}> {
  const res = await api.post<{ticketId?: string; attempt?: number; callOutTotal?: number; noCandidates?: boolean}>("/dispatch/sos/continue", {ticketId}, token);
  bustTicketCaches(token);
  return res;
}

export async function respondReturnTow(ticketId: string, accept: boolean, token: string, destinationPoint?: {lat: number; lng: number; label?: string}): Promise<{accepted: boolean; ticketId?: string}> {
  const res = await api.post<{accepted: boolean; ticketId?: string}>("/dispatch/walk-in/return-tow", {ticketId, accept, ...(destinationPoint ? {destinationPoint} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function setMobileShopFix(ticketId: string, fixAmount: number, token: string, items?: Array<Pick<WorkItem, "name" | "qty" | "unitPrice" | "serviceCode">>): Promise<{updated: number}> {
  const res = await api.post<{updated: number}>("/dispatch/mobile-shop/fix", {ticketId, fixAmount, ...(items && items.length > 0 ? {items} : {})}, token);
  bustTicketCaches(token);
  return res;
}

export async function reportUnfixable(ticketId: string, reason: string, photoUrls: string[], token: string): Promise<{unfixable: boolean; continuationTicketId?: string; noCandidates?: boolean; requiresContinuationConfirmation?: boolean; nextAttempt?: number; callOutTotal?: number}> {
  const res = await api.post<{unfixable: boolean; continuationTicketId?: string; noCandidates?: boolean; requiresContinuationConfirmation?: boolean; nextAttempt?: number; callOutTotal?: number}>("/dispatch/unfixable", {ticketId, reason, photoUrls}, token);
  bustTicketCaches(token);
  return res;
}

export type FileDisputePayload = {
  ticketId: string;
  reason: string;
  note?: string;
  photoUrl?: string;
  photoUrls?: string[];
};

export async function fileDispute(payload: FileDisputePayload, token: string): Promise<{id: string}> {
  const res = await api.post<{id: string}>("/disputes", payload, token);
  bustTicketCaches(token);
  return res;
}

export type SepayCheckout = {
  action: string;
  method: string;
  fields: Record<string, string>;
  qrUrl?: string | null;
};

export type TicketPayment = {
  id: string;
  ticketId: string;
  method: string;
  status: string;
  amount?: number | null;
  checkoutUrl?: string | null;
  checkout?: SepayCheckout | null;
  waitingFee?: number | null;
  unfixable?: boolean | null;
  disputeId?: string | null;
  disputedAt?: string | null;
  disputeHold?: boolean;
  disputeResolvedAt?: string | null;
};

type PaymentWire = TicketPayment;

function toSepayCheckout(raw: unknown): SepayCheckout | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.action !== "string" || value.action === "") return null;
  if (typeof value.method !== "string" || value.method === "") return null;
  if (!value.fields || typeof value.fields !== "object" || Array.isArray(value.fields)) return null;
  const fields: Record<string, string> = {};
  Object.entries(value.fields as Record<string, unknown>).forEach(([key, field]) => {
    if (typeof field === "string") fields[key] = field;
  });
  return {
    action: value.action,
    method: value.method,
    fields,
    qrUrl: typeof value.qrUrl === "string" ? value.qrUrl : null,
  };
}

function toTicketPayment(raw: PaymentWire): TicketPayment {
  const checkout = toSepayCheckout(raw.checkout);
  const checkoutUrl = typeof raw.checkout?.qrUrl === "string" && raw.checkout.qrUrl !== "" ? raw.checkout.qrUrl : null;
  return {
    id: raw.id,
    ticketId: raw.ticketId,
    method: raw.method,
    status: raw.status,
    amount: typeof raw.amount === "number" ? raw.amount : null,
    checkoutUrl: checkout?.qrUrl ?? checkoutUrl,
    checkout,
    waitingFee: typeof raw.waitingFee === "number" ? raw.waitingFee : null,
    unfixable: raw.unfixable === true ? true : null,
    disputeId: typeof raw.disputeId === "string" ? raw.disputeId : null,
    disputedAt: typeof raw.disputedAt === "string" ? raw.disputedAt : null,
    disputeHold: raw.disputeHold === true,
    disputeResolvedAt: typeof raw.disputeResolvedAt === "string" ?
      raw.disputeResolvedAt :
      null,
  };
}

export async function createPayment(ticketId: string, method: string, token: string): Promise<TicketPayment> {
  const res = await api.post<PaymentWire>("/payments/create", {ticketId, method}, token);
  return toTicketPayment(res);
}

export function cancelPayment(ticketId: string, token: string): Promise<{cancelled: boolean; method: string | null}> {
  return api.post<{cancelled: boolean; method: string | null}>("/payments/cancel", {ticketId}, token);
}

export async function confirmCashReceipt(ticketId: string, token: string): Promise<TicketPayment> {
  const res = await api.post<PaymentWire>("/payments/confirm-cash", {ticketId}, token);
  return toTicketPayment(res);
}

export async function fetchTicketPayments(ticketId: string, token: string): Promise<TicketPayment[]> {
  const res = await api.post<PaymentWire[]>("/payments/one", {ticketId}, token);
  return Array.isArray(res) ? res.map(toTicketPayment) : [];
}

export async function refreshWaiting(ticketId: string, token: string): Promise<{waitingMinutes: number; waitingFee: number}> {
  const res = await api.post<{active: boolean; elapsedSeconds: number; fee: number}>("/dispatch/waiting", {ticketId}, token);
  bustTicketCaches(token);
  return {waitingMinutes: Math.ceil(res.elapsedSeconds / 60), waitingFee: typeof res.fee === "number" ? res.fee : 0};
}
