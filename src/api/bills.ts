import {api} from "./client";
import {CACHE_TTL_MS, withCache} from "../services/cache";

export type BillViewer = "RIDER" | "PAYEE" | "OPERATOR" | "ADMIN";

export type BillPayoutStatus = "NONE" | "PENDING" | "PAID";

export type BillPayment = {
  id: string;
  method: string;
  status: string;
  amount: number;
  refundAmount: number | null;
  commissionRate: number | null;
  commissionAmount: number | null;
  payoutAmount: number | null;
  payoutRef: string | null;
  payoutAt: string | null;
  payoutStatus: BillPayoutStatus;
  canConfirmCash: boolean;
  disputeId?: string | null;
  disputedAt?: string | null;
  disputeHold?: boolean;
  disputeResolvedAt?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
};

export type BillItem = {
  kind: string;
  ticketId: string;
  ticketType: string;
  ticketStatus: string;
  amount: number;
  waitingFee: number;
  distanceKm?: number | null;
  totalDistanceKm?: number | null;
  deadheadKm?: number | null;
  loadedQuotedKm?: number | null;
  baseFee?: number | null;
  perKmFee?: number | null;
  includedKm?: number | null;
  billableKm?: number | null;
  ceiling?: number | null;
  night?: boolean | null;
  nightMultiplier?: number | null;
  vehicleClass?: string | null;
  pickup?: {lat: number; lng: number} | null;
  destination?: {
    lat: number;
    lng: number;
    shopId?: string | null;
    name?: string | null;
    label?: string | null;
  } | null;
  warrantyUntil?: string | null;
  refundRequest?: {
    id: string;
    status: string;
    amount: number;
    transferRef: string | null;
    requestedAt: string;
  } | null;
  dispute?: {
    id: string;
    status: string;
    type: string;
    reasonCode: string;
    outcome: string | null;
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
  } | null;
  disputes?: Array<{
    id: string;
    status: string;
    type: string;
    reasonCode: string;
    outcome: string | null;
    createdAt: string;
    resolvedAt: string | null;
  }>;
  breakdown?: Array<{
    code?: string;
    label: string;
    amount: number;
    detail: string | null;
  }>;
  items?: Array<{
    lineId?: string;
    kind?: string;
    serviceCode?: string;
    category?: string;
    name: string;
    qty: number;
    unitPrice: number;
    amount: number;
    priceMode?: string;
    listPrice?: number;
    warrantyDays?: number;
    warrantyUntil?: string | null;
    note?: string;
    legacy?: boolean;
  }>;
  services?: Array<{
    lineId?: string;
    serviceCode?: string;
    category?: string;
    name: string;
    qty: number;
    unitPrice: number;
    amount: number;
    priceMode?: string;
    warrantyUntil?: string | null;
  }>;
  extras?: Array<{
    lineId?: string;
    name: string;
    qty: number;
    unitPrice: number;
    amount: number;
    note?: string;
  }>;
  status: string;
  serviceType?: "TOW" | "REPAIR" | "SOS";
  rider?: {uid: string; name: string; phone: string | null} | null;
  provider?: {
    id: string;
    name: string;
    kind: string;
    phone: string | null;
    label: string | null;
  } | null;
  vehicleLabel?: string | null;
  vehiclePlate?: string | null;
  mobileTravelKm?: number | null;
  mobileTravelRate?: number | null;
  amountDue?: number;
  deposit?: {
    amount: number;
    status: string;
    method: string | null;
    paidAt: string | null;
  } | null;
  payeeId: string | null;
  payeeName: string | null;
  qrUrl: string | null;
  payment: BillPayment | null;
};

export type Bill = {
  billId: string;
  ticketId: string;
  ticketType: string;
  ticketStatus: string;
  createdAt: string | null;
  currency: string;
  total: number;
  paid: number;
  due: number;
  status: string;
  viewer: BillViewer;
  canPay: boolean;
  items: BillItem[];
};

export async function myBills(token: string, limit?: number): Promise<Bill[]> {
  return api.post<Bill[]>("/bills/all", typeof limit === "number" ? {limit} : {}, token);
}

export async function payeeBills(token: string, limit?: number): Promise<Bill[]> {
  const key = `billsPayee:${token}:${limit ?? 0}`;
  return withCache(key, CACHE_TTL_MS.billsPayee, () => api.post<Bill[]>("/bills/payee", typeof limit === "number" ? {limit} : {}, token));
}

export async function fetchBill(token: string, params: {ticketId?: string; billId?: string; scope?: "payee"}): Promise<Bill> {
  return api.post<Bill>("/bills/one", params, token);
}

export function requestInvoice(ticketId: string, token: string): Promise<{
  invoiceId: string;
  number: string;
  url: string;
  expiresAt: string;
  status: string;
}> {
  return api.post("/bills/invoice", {ticketId}, token);
}
