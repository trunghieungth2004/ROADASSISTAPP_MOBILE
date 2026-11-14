import type {Bill, BillItem, BillPayoutStatus} from "../../api/bills";
import type {RefundRequest} from "../../api/refunds";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

const RECEIVED = new Set(["HELD", "CONFIRMED", "PARTIAL"]);

export type PayeeSummary = {
  gross: number;
  collected: number;
  commission: number;
  net: number;
  payout: BillPayoutStatus;
};

export function itemPayoutStatus(item: BillItem): BillPayoutStatus {
  const payment = item.payment;
  if (!payment) return "NONE";
  if (payment.payoutStatus) return payment.payoutStatus;
  if (typeof payment.payoutAt === "string" && payment.payoutAt !== "") return "PAID";
  if (RECEIVED.has(payment.status)) return "PENDING";
  return "NONE";
}

export function itemNetPayout(item: BillItem): number {
  const payment = item.payment;
  if (!payment) return 0;
  if (typeof payment.payoutAmount === "number") return payment.payoutAmount;
  return Math.max(0, item.amount - (payment.commissionAmount ?? 0));
}

export function payeeSummary(bill: Bill): PayeeSummary {
  let gross = 0;
  let collected = 0;
  let commission = 0;
  let net = 0;
  let received = 0;
  let paidOut = 0;
  for (const item of bill.items) {
    gross += item.amount;
    const payment = item.payment;
    if (!payment || !RECEIVED.has(payment.status)) continue;
    received += 1;
    collected += payment.amount;
    commission += payment.commissionAmount ?? 0;
    net += itemNetPayout(item);
    if (itemPayoutStatus(item) === "PAID") paidOut += 1;
  }
  const payout: BillPayoutStatus = received === 0 ?
    "NONE" :
    paidOut === received ? "PAID" : "PENDING";
  return {gross, collected, commission, net, payout};
}

export function payoutStatusLabel(status: BillPayoutStatus, t: Strings): string {
  if (status === "PAID") return t.payments.payoutPaid;
  if (status === "PENDING") return t.payments.payoutPending;
  return t.payments.payoutNone;
}

export function payoutStatusColor(status: BillPayoutStatus, theme: AppTheme): string {
  if (status === "PAID") return theme.success;
  if (status === "PENDING") return "#d97706";
  return theme.muted;
}

const OPEN_REFUND_STATUSES = new Set(["REQUESTED", "APPROVED", "SENT"]);

export function refundStatusLabel(status: string, t: Strings): string {
  if (status === "APPROVED") return t.payments.refundStatusAPPROVED;
  if (status === "SENT") return t.payments.refundStatusSENT;
  if (status === "CONFIRMED") return t.payments.refundStatusCONFIRMED;
  if (status === "REJECTED") return t.payments.refundStatusREJECTED;
  if (status === "FAILED") return t.payments.refundStatusFAILED;
  return t.payments.refundStatusREQUESTED;
}

export function refundStatusColor(status: string, theme: AppTheme): string {
  if (status === "CONFIRMED") return theme.success;
  if (status === "REJECTED" || status === "FAILED") return theme.danger;
  if (status === "REQUESTED") return "#d97706";
  return theme.primary;
}

export function refundOpenAmount(refunds: RefundRequest[]): number {
  return refunds.reduce((sum, refund) =>
    OPEN_REFUND_STATUSES.has(refund.status) ? sum + refund.amount : sum, 0);
}

export function refundReceivedAmount(refunds: RefundRequest[]): number {
  return refunds.reduce((sum, refund) =>
    refund.status === "CONFIRMED" ? sum + refund.amount : sum, 0);
}

export function billStatusLabel(status: string, t: Strings): string {
  if (status === "PAID") return t.bills.statusPaid;
  if (status === "PARTIAL") return t.bills.statusPartial;
  if (status === "VOID") return t.bills.statusVoid;
  return t.bills.statusUnpaid;
}

export function billStatusColor(status: string, theme: AppTheme): string {
  if (status === "PAID") return theme.success;
  if (status === "PARTIAL") return "#d97706";
  if (status === "VOID") return theme.muted;
  return theme.primary;
}

export function billItemLabel(item: BillItem, t: Strings): string {
  if (item.ticketType === "SOS") return t.assist.mobileCallOut;
  return item.kind === "TOW_FARE" ? t.bills.towFare : t.bills.repair;
}

export function billItemStatusLabel(status: string, t: Strings): string {
  if (status === "PAID") return t.bills.itemPaid;
  if (status === "PENDING") return t.bills.itemPending;
  if (status === "REFUNDED") return t.bills.itemRefunded;
  if (status === "PARTIAL") return t.bills.itemPartial;
  if (status === "VOID") return t.bills.itemVoid;
  return t.bills.itemUnpaid;
}

export function billItemStatusColor(status: string, theme: AppTheme): string {
  if (status === "PAID") return theme.success;
  if (status === "PENDING") return theme.primary;
  if (status === "REFUNDED" || status === "PARTIAL") return "#8b5cf6";
  if (status === "VOID") return theme.muted;
  return "#d97706";
}

export function billDateLabel(createdAt: string | null): string {
  if (!createdAt) return "";
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return "";
  const day = String(at.getDate()).padStart(2, "0");
  const month = String(at.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${at.getFullYear()}`;
}

export function billDateTimeLabel(createdAt: string | null): string {
  if (!createdAt) return "";
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return "";
  const day = String(at.getDate()).padStart(2, "0");
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const hours = String(at.getHours()).padStart(2, "0");
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${at.getFullYear()} · ${hours}:${minutes}`;
}

export function billServiceType(bill: Bill): "TOW" | "REPAIR" | "SOS" {
  const row = bill.items.find((item) => item.serviceType !== undefined);
  if (row?.serviceType !== undefined) return row.serviceType;
  if (bill.ticketType === "TOW") return "TOW";
  if (bill.ticketType === "SOS") return "SOS";
  return "REPAIR";
}

export function billMatchesService(
  bill: Bill,
  service: "TOW" | "REPAIR" | "SOS",
): boolean {
  if (bill.items.length === 0) return billServiceType(bill) === service;
  return bill.items.some((item) => {
    const type = item.serviceType ??
      (bill.ticketType === "TOW" ? "TOW" :
        bill.ticketType === "SOS" ? "SOS" : "REPAIR");
    return type === service;
  });
}

export function billTitle(bill: Bill, t: Strings): string {
  if (bill.ticketType === "SOS") return t.assist.mobileCallOut;
  const kind = bill.items[0]?.kind;
  if (kind === "TOW_FARE") return t.bills.towFare;
  if (kind === "REPAIR") return t.bills.visit;
  return bill.ticketType === "TOW" ? t.bills.towFare : t.bills.visit;
}

export function billItemCount(bill: Bill, t: Strings): string {
  return `${bill.items.length} ${bill.items.length === 1 ? t.bills.item : t.bills.items}`;
}

export function billPayeeLabel(bill: Bill): string | null {
  const names = bill.items
    .map((item) => item.payeeName)
    .filter((name): name is string => typeof name === "string" && name !== "");
  if (names.length === 0) return null;
  return [...new Set(names)].join(" · ");
}
