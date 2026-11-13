import type {Strings} from "../../i18n/en";

export function disputeTypeLabel(type: string, t: Strings): string {
  if (type === "FARE_DISPUTE") return t.dispute.typeFareDispute;
  if (type === "SERVICE_QUALITY") return t.dispute.typeServiceQuality;
  if (type === "UNFIXABLE_DISAGREEMENT") return t.dispute.typeUnfixable;
  if (type === "PROVIDER_NO_SHOW") return t.dispute.typeProviderNoShow;
  if (type === "PROVIDER_LATE") return t.dispute.typeProviderLate;
  if (type === "TOWER_CANCEL_MID") return t.dispute.typeTowerCancel;
  if (type === "SHOP_DECLINE_DROPOFF") return t.dispute.typeShopDecline;
  if (type === "RIDER_NO_SHOW") return t.dispute.typeRiderNoShow;
  if (type === "RIDER_PAYMENT") return t.dispute.typeRiderPayment;
  if (type === "SAFETY_CONDUCT") return t.dispute.typeSafety;
  if (type === "RIDER_CONDUCT") return t.dispute.typeRiderConduct;
  if (type === "OTHER") return t.dispute.typeOther;
  return "";
}

export function disputeLabel(
  type: string,
  reasonCode: string,
  t: Strings,
): string {
  const label = disputeTypeLabel(type, t);
  if (label !== "") return label;
  return (reasonCode === "" ? type : reasonCode).replaceAll("_", " ");
}

export function disputeResultLabel(
  status: string,
  outcome: string | null | undefined,
  t: Strings,
): string {
  if (status === "OPEN") return t.dispute.resultOpen;
  if (status === "DISMISSED") return t.dispute.resultDismissed;
  if (outcome === "RIDER") return t.dispute.resultRider;
  if (outcome === "PARTIAL") return t.dispute.resultPartial;
  if (outcome === "SHOP") return t.dispute.resultProvider;
  return t.dispute.resultOpen;
}
