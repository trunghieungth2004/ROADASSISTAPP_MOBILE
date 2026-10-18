export type PaymentMethod = "CASH" | "SEPAY";

export type PaymentStatus = "PENDING" | "HELD" | "CONFIRMED" | "REFUNDED" | "PARTIAL";

export function paymentMethodLabel(method: string | null | undefined): string {
  if (method === "SEPAY") return "SePay";
  return "Cash";
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (status === "HELD") return "Held";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "REFUNDED") return "Refunded";
  if (status === "PARTIAL") return "Partial";
  return "Pending";
}
