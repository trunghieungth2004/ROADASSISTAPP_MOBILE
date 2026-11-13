import {DISPATCH_STATUS} from "../../api/dispatch";

const PROVIDER_NO_SHOW = new Set<string>([
  DISPATCH_STATUS.MATCHED,
  DISPATCH_STATUS.QUOTED,
  DISPATCH_STATUS.ESTIMATED,
  DISPATCH_STATUS.CANCELLED,
  DISPATCH_STATUS.DECLINED,
  DISPATCH_STATUS.UNFIXABLE,
  DISPATCH_STATUS.RESOLVED_UNFIXABLE,
]);

const RIDER_NO_SHOW = new Set<string>([
  DISPATCH_STATUS.MATCHED,
  DISPATCH_STATUS.ARRIVED,
  DISPATCH_STATUS.CANCELLED,
  DISPATCH_STATUS.DECLINED,
  DISPATCH_STATUS.UNFIXABLE,
  DISPATCH_STATUS.RESOLVED_UNFIXABLE,
]);

export function reportReasonsFor(
  viewer: "RIDER" | "PROVIDER",
  status: string,
): string[] {
  if (status === DISPATCH_STATUS.PENDING) return [];
  if (viewer === "PROVIDER") {
    const reasons: string[] = [];
    if (RIDER_NO_SHOW.has(status)) reasons.push("NO_SHOW");
    reasons.push("LATE");
    if (status === DISPATCH_STATUS.RESOLVED) reasons.push("PAYMENT_REFUSED");
    reasons.push("CONDUCT", "UNSAFE", "OTHER");
    return reasons;
  }
  const reasons: string[] = [];
  if (PROVIDER_NO_SHOW.has(status)) reasons.push("NO_SHOW");
  reasons.push("LATE", "UNSAFE", "HARASSMENT", "OTHER");
  return reasons;
}
