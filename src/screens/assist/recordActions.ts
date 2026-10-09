import {DISPATCH_STATUS, isTerminal, riderActionsFor, type FeedDirection, type RiderAction} from "../../api/dispatch";

export function canRate(status: string): boolean {
  return status === DISPATCH_STATUS.RESOLVED;
}

export function canCancel(status: string): boolean {
  return status === DISPATCH_STATUS.PENDING || status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.QUOTED;
}

export function visibleActions(status: string): RiderAction[] {
  return riderActionsFor(status);
}

export function canAccept(direction: FeedDirection, status: string): boolean {
  return direction === "in" && status === DISPATCH_STATUS.PENDING;
}

export function canDecline(direction: FeedDirection, status: string): boolean {
  return direction === "in" && status === DISPATCH_STATUS.PENDING;
}

export function canEditWork(direction: FeedDirection, status: string, hasShop: boolean): boolean {
  if (direction !== "in" || !hasShop) return false;
  return status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED || status === DISPATCH_STATUS.IN_PROGRESS;
}

export function canRateRider(direction: FeedDirection, status: string): boolean {
  return direction === "in" && status === DISPATCH_STATUS.RESOLVED;
}

export function canStartWork(direction: FeedDirection, status: string, ticketType: string, hasQuote: boolean, hasShop: boolean): boolean {
  if (direction !== "in" || hasQuote || !hasShop) return false;
  if (status === DISPATCH_STATUS.ARRIVED) return true;
  return status === DISPATCH_STATUS.MATCHED && ticketType === "WALK_IN";
}

export function canMarkReady(direction: FeedDirection, status: string, hasShop: boolean): boolean {
  return direction === "in" && status === DISPATCH_STATUS.IN_PROGRESS && hasShop;
}

export function canSendQuote(direction: FeedDirection, status: string, hasShop: boolean): boolean {
  if (direction !== "in" || !hasShop) return false;
  return status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED;
}

export function canApproveQuote(direction: FeedDirection, status: string): boolean {
  return direction === "out" && status === DISPATCH_STATUS.QUOTED;
}

export function canResolve(direction: FeedDirection, status: string): boolean {
  return direction === "out" && status === DISPATCH_STATUS.READY;
}

export function canDeclineDestination(status: string, destinationShopId: string | null | undefined, ownShopIds: Set<string>): boolean {
  if (typeof destinationShopId !== "string" || destinationShopId === "") return false;
  if (!ownShopIds.has(destinationShopId)) return false;
  if (status === DISPATCH_STATUS.PENDING || isTerminal(status)) return false;
  return true;
}
