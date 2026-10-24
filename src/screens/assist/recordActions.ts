import {DISPATCH_STATUS, isTerminal, riderActionsFor, type FeedDirection, type FeedTicket, type RiderAction} from "../../api/dispatch";
import {towDestOf} from "./towDest";

export function canRate(status: string): boolean {
  return status === DISPATCH_STATUS.RESOLVED;
}

export function canCancel(status: string): boolean {
  return status === DISPATCH_STATUS.PENDING || status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.QUOTED;
}

export function visibleActions(status: string): RiderAction[] {
  return riderActionsFor(status);
}

export type ViewerRoleKind = "SHOP" | "TOW";

export type ViewerRole =
  | {kind: "rider"}
  | {kind: "assigned"; assignedKind: ViewerRoleKind | null}
  | {kind: "candidate"; candidateKind: ViewerRoleKind}
  | {kind: "destination"}
  | {kind: "other"};

export type ViewerScope = {
  ownShopIds: Set<string>;
  ownTowId: string | null;
  ownMobileShopId?: string | null;
  uid: string | null;
  hasVolunteer: boolean;
};

function idOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export type ViewerRoleContext = "auto" | "shop" | "tow";

export function viewerRoleOf(
  ticket: Pick<FeedTicket, "direction" | "status" | "ticketType" | "assignedShopId" | "providerId" | "destinationShopId" | "assignedUid">,
  scope: ViewerScope,
  context: ViewerRoleContext = "auto",
): ViewerRole {
  if (ticket.direction === "out") return {kind: "rider"};
  const assigned = idOf(ticket.assignedShopId);
  const addressed = idOf(ticket.providerId);
  const destination = idOf(ticket.destinationShopId);
  if (context === "shop") {
    if (assigned !== null && scope.ownShopIds.has(assigned)) return {kind: "assigned", assignedKind: "SHOP"};
    if (assigned !== null && scope.ownMobileShopId !== null && assigned === scope.ownMobileShopId) return {kind: "assigned", assignedKind: "SHOP"};
    if (ticket.status === DISPATCH_STATUS.PENDING && addressed !== null && scope.ownShopIds.has(addressed)) return {kind: "candidate", candidateKind: "SHOP"};
    if (ticket.status === DISPATCH_STATUS.PENDING && ticket.ticketType === "SOS" && scope.ownMobileShopId !== null) return {kind: "candidate", candidateKind: "SHOP"};
    if (destination !== null && scope.ownShopIds.has(destination)) return {kind: "destination"};
    if (ticket.ticketType !== "TOW") {
      if (scope.hasVolunteer && scope.uid !== null && idOf(ticket.assignedUid) === scope.uid) return {kind: "assigned", assignedKind: null};
    }
    return {kind: "other"};
  }
  if (context === "tow") {
    if (assigned !== null && scope.ownTowId !== null && assigned === scope.ownTowId) return {kind: "assigned", assignedKind: "TOW"};
    if (scope.hasVolunteer && scope.uid !== null && idOf(ticket.assignedUid) === scope.uid) return {kind: "assigned", assignedKind: null};
    if (ticket.status === DISPATCH_STATUS.PENDING && ticket.ticketType === "TOW" && (scope.ownTowId !== null || scope.hasVolunteer)) return {kind: "candidate", candidateKind: "TOW"};
    return {kind: "other"};
  }
  if (assigned !== null) {
    if (scope.ownShopIds.has(assigned)) return {kind: "assigned", assignedKind: "SHOP"};
    if (scope.ownMobileShopId !== null && assigned === scope.ownMobileShopId) return {kind: "assigned", assignedKind: "SHOP"};
    if (scope.ownTowId !== null && assigned === scope.ownTowId) return {kind: "assigned", assignedKind: "TOW"};
  }
  if (scope.hasVolunteer && scope.uid !== null && idOf(ticket.assignedUid) === scope.uid) {
    return {kind: "assigned", assignedKind: null};
  }
  if (ticket.status === DISPATCH_STATUS.PENDING) {
    if (addressed !== null && scope.ownShopIds.has(addressed)) return {kind: "candidate", candidateKind: "SHOP"};
    if (ticket.ticketType === "SOS" && scope.ownMobileShopId !== null) return {kind: "candidate", candidateKind: "SHOP"};
    if (ticket.ticketType === "TOW" && (scope.ownTowId !== null || scope.hasVolunteer)) return {kind: "candidate", candidateKind: "TOW"};
  }
  if (destination !== null && scope.ownShopIds.has(destination)) return {kind: "destination"};
  return {kind: "other"};
}

export function canAccept(role: ViewerRole): boolean {
  return role.kind === "candidate";
}

export function canDecline(role: ViewerRole): boolean {
  return role.kind === "candidate";
}

const SHOP_TYPES = new Set(["WALK_IN", "MECHANIC"]);

export function canEditWork(direction: FeedDirection, status: string, hasShop: boolean, ticketType: string): boolean {
  if (direction !== "in" || !hasShop) return false;
  if (!SHOP_TYPES.has(ticketType)) return false;
  return status === DISPATCH_STATUS.IN_PROGRESS;
}

export function canRateRider(role: ViewerRole, status: string): boolean {
  return role.kind === "assigned" && status === DISPATCH_STATUS.RESOLVED;
}

export function canStartWork(direction: FeedDirection, status: string, ticketType: string, hasQuote: boolean, hasShop: boolean): boolean {
  if (direction !== "in" || hasQuote || !hasShop) return false;
  if (ticketType !== "SOS") return false;
  return status === DISPATCH_STATUS.ARRIVED;
}

export function canMarkReady(direction: FeedDirection, status: string, ticketType: string, hasShop: boolean): boolean {
  if (direction !== "in" || !hasShop) return false;
  if (!SHOP_TYPES.has(ticketType)) return false;
  return status === DISPATCH_STATUS.IN_PROGRESS;
}

export function canSendQuote(direction: FeedDirection, status: string, ticketType: string, hasShop: boolean): boolean {
  if (direction !== "in" || !hasShop) return false;
  if (!SHOP_TYPES.has(ticketType)) return false;
  return status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED || status === DISPATCH_STATUS.IN_SHOP || status === DISPATCH_STATUS.ESTIMATED || status === DISPATCH_STATUS.EST_APPROVED;
}

export function canMarkUnfixable(ticketType: string, status: string): boolean {
  if (ticketType === "SOS") {
    return status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED;
  }
  if (!SHOP_TYPES.has(ticketType)) return false;
  return status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED || status === DISPATCH_STATUS.IN_PROGRESS || status === DISPATCH_STATUS.QUOTED || status === DISPATCH_STATUS.IN_SHOP || status === DISPATCH_STATUS.FINAL_QUOTED;
}

export function canApproveQuote(direction: FeedDirection, status: string): boolean {
  return direction === "out" && status === DISPATCH_STATUS.QUOTED;
}

export function canResolve(direction: FeedDirection, status: string): boolean {
  return direction === "out" && status === DISPATCH_STATUS.READY;
}

export function canDeclineDestination(status: string, isDestinationShop: boolean): boolean {
  if (!isDestinationShop) return false;
  return !isTerminal(status);
}

export function canEditDestination(direction: FeedDirection, status: string, ticketType: string): boolean {
  if (direction !== "out") return false;
  if (ticketType !== "TOW") return false;
  return status === DISPATCH_STATUS.PENDING || status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED;
}

export function canSeeRequestPhotos(ticket: Pick<FeedTicket, "direction" | "ticketType" | "status" | "assignedShopId" | "providerId" | "destinationShopId" | "assignedUid">, ownShopIds: Set<string>, uid: string | null, hasVolunteer: boolean, ownTowId: string | null = null, roleContext: ViewerRoleContext = "auto", ownMobileShopId: string | null = null): boolean {
  if (ticket.direction === "out") return true;
  if (typeof ticket.assignedShopId === "string" && ownShopIds.has(ticket.assignedShopId)) return true;
  if (typeof ticket.providerId === "string" && ownShopIds.has(ticket.providerId)) return true;
  if (typeof ticket.destinationShopId === "string" && ownShopIds.has(ticket.destinationShopId)) return true;
  if (ticket.ticketType === "TOW" && ownTowId !== null) {
    if (ticket.assignedShopId === ownTowId || ticket.providerId === ownTowId) return true;
    if (roleContext === "tow" && ticket.status === "1") return true;
  }
  if (ticket.ticketType === "SOS" && ownMobileShopId !== null) {
    if (ticket.assignedShopId === ownMobileShopId) return true;
    if (roleContext === "shop" && ticket.status === "1") return true;
  }
  return hasVolunteer && uid !== null && ticket.assignedUid === uid;
}

export function retargetableLiveTicket(feed: FeedTicket[], ticketId: string): FeedTicket | null {
  const row = feed.find((t) => t.id === ticketId) ?? null;
  if (!row) return null;
  if (!canEditDestination(row.direction, row.status, row.ticketType)) return null;
  if (towDestOf(row) !== null) return null;
  return row;
}

export function announcesShopPush(feed: FeedTicket[], ownShopIds: Set<string>, ticketId: string): boolean {
  const row = feed.find((t) => t.id === ticketId) ?? null;
  if (!row || row.direction !== "in" || row.status !== DISPATCH_STATUS.PENDING) return false;
  return (typeof row.destinationShopId === "string" && ownShopIds.has(row.destinationShopId)) ||
    (typeof row.providerId === "string" && ownShopIds.has(row.providerId));
}

export const DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function canDispute(status: string): boolean {
  return !isTerminal(status) && status !== DISPATCH_STATUS.PENDING;
}

export function canDisputeResolved(ticket: Pick<FeedTicket, "status" | "towFare" | "shopQuotedAmount" | "finalAmount" | "statusHistory">, now: number = Date.now()): boolean {
  if (ticket.status !== DISPATCH_STATUS.RESOLVED) return false;
  const fared = typeof ticket.towFare?.estimate === "number" || typeof ticket.shopQuotedAmount === "number" || typeof ticket.finalAmount === "number";
  if (!fared) return false;
  const history = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const resolved = history.filter((entry) => entry.status === DISPATCH_STATUS.RESOLVED).pop();
  if (!resolved || typeof resolved.at !== "string" || resolved.at === "") return true;
  const at = Date.parse(resolved.at);
  if (Number.isNaN(at)) return true;
  return now - at <= DISPUTE_WINDOW_MS;
}

export type EstimateState = "none" | "pending" | "approved" | "expired";

export function estimateStateOf(ticket: Pick<FeedTicket, "estimateAmount" | "estimateApprovedAt" | "estimateExpiresAt">, now: number = Date.now()): EstimateState {
  if (typeof ticket.estimateAmount !== "number") return "none";
  if (typeof ticket.estimateApprovedAt === "string" && ticket.estimateApprovedAt !== "") return "approved";
  if (typeof ticket.estimateExpiresAt === "string" && ticket.estimateExpiresAt !== "") {
    const at = Date.parse(ticket.estimateExpiresAt);
    if (!Number.isNaN(at) && at <= now) return "expired";
  }
  return "pending";
}

export function canSendEstimate(direction: FeedDirection, ticketType: string, status: string, isDestinationShop: boolean, state: EstimateState): boolean {
  if (direction !== "in" || !isDestinationShop) return false;
  if (ticketType !== "TOW") return false;
  if (status !== DISPATCH_STATUS.PENDING && status !== DISPATCH_STATUS.MATCHED && status !== DISPATCH_STATUS.ARRIVED) return false;
  return state === "none" || state === "expired";
}
