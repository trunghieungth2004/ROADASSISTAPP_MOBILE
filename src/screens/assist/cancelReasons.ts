import type {Strings} from "../../i18n/en";

export const TOWER_CANCEL_REASONS = [
  "TOWER_CANCEL_BREAKDOWN",
  "TOWER_CANCEL_SAFETY",
  "TOWER_CANCEL_UNREACHABLE",
  "TOWER_CANCEL_OTHER",
] as const;

export const QUOTE_DECLINE_REASONS = [
  "PRICE_TOO_HIGH",
  "WORK_NOT_DONE",
  "ITEMS_WRONG",
  "OTHER",
] as const;

export const SHOP_DECLINE_REASONS = [
  "SHOP_FULL",
  "SHOP_CLOSED",
  "SHOP_PARTS_DELAY",
  "SHOP_OTHER",
] as const;

export function towerCancelReasonLabel(reason: string, t: Strings): string {
  if (reason === "TOWER_CANCEL_BREAKDOWN") return t.assist.towerCancelBreakdown;
  if (reason === "TOWER_CANCEL_SAFETY") return t.assist.towerCancelSafety;
  if (reason === "TOWER_CANCEL_UNREACHABLE") return t.assist.towerCancelUnreachable;
  return t.assist.towerCancelOther;
}

export function quoteDeclineReasonLabel(reason: string, t: Strings): string {
  if (reason === "PRICE_TOO_HIGH") return t.assist.quoteDeclinePrice;
  if (reason === "WORK_NOT_DONE") return t.assist.quoteDeclineWork;
  if (reason === "ITEMS_WRONG") return t.assist.quoteDeclineItems;
  return t.assist.quoteDeclineOther;
}

export function shopDeclineReasonLabel(reason: string, t: Strings): string {
  if (reason === "SHOP_FULL") return t.assist.shopDeclineFull;
  if (reason === "SHOP_CLOSED") return t.assist.shopDeclineClosed;
  if (reason === "SHOP_PARTS_DELAY") return t.assist.shopDeclineParts;
  return t.assist.shopDeclineOther;
}
