import type {Bill, BillItem} from "../../api/bills";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";

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

export function billTitle(bill: Bill, t: Strings): string {
  return bill.ticketType === "TOW" ? t.bills.journey : t.bills.visit;
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
