import {DISPATCH_STATUS, riderActionsFor, type FeedDirection, type RiderAction} from "../../api/dispatch";

export function canRate(status: string): boolean {
  return status === DISPATCH_STATUS.RESOLVED;
}

export function canCancel(status: string): boolean {
  return status === DISPATCH_STATUS.PENDING || status === DISPATCH_STATUS.MATCHED;
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

export function canEditWork(direction: FeedDirection, status: string): boolean {
  return direction === "in" && (status === DISPATCH_STATUS.MATCHED || status === DISPATCH_STATUS.ARRIVED || status === DISPATCH_STATUS.IN_PROGRESS);
}

export function canRateRider(direction: FeedDirection, status: string): boolean {
  return direction === "in" && status === DISPATCH_STATUS.RESOLVED;
}
