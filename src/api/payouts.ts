import {api} from "./client";

export type PayoutTotals = {
  gross: number;
  commission: number;
  net: number;
  itemCount: number;
};

export type PayoutBatch = PayoutTotals & {
  id: string;
  payeeName: string | null;
  refunded: number;
  commissionDeducted?: number;
  netPayout?: number;
  status: string;
  payoutRef: string;
  note: string | null;
  batchedAt: string;
  createdAt: string;
};

export type PayoutAccount = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
  updatedAt: string;
};

export type PayoutBank = {
  code: string;
  name: string;
  bin: string;
};

export type PayoutRequest = {
  id: string;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED" | "CANCELLED";
  bankCode: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type PayoutSummary = {
  batches: PayoutBatch[];
  pending: PayoutTotals & {refunded: number; commissionOwed: number; available: number};
  settled: PayoutTotals;
  account: PayoutAccount | null;
  requests: PayoutRequest[];
  pendingRequestCount?: number;
};

export async function myPayouts(token: string, limit?: number): Promise<PayoutSummary> {
  return api.post<PayoutSummary>("/payouts/mine", typeof limit === "number" ? {limit} : {}, token);
}

export function payoutBanks(token: string): Promise<PayoutBank[]> {
  return api.post<PayoutBank[]>("/payouts/banks", {}, token);
}

export function payoutAccount(token: string): Promise<PayoutAccount | null> {
  return api.post<PayoutAccount | null>("/payouts/account", {}, token);
}

export function savePayoutAccount(payload: {bankCode: string; accountNumber: string; holderName: string}, token: string): Promise<PayoutAccount> {
  return api.put<PayoutAccount>("/payouts/account", payload, token);
}

export function requestPayout(payload: {amount: number; note?: string}, token: string): Promise<PayoutRequest> {
  return api.post<PayoutRequest>("/payouts/request", payload, token);
}
