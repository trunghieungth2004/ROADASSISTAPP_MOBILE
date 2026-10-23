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
  status: string;
  payoutRef: string;
  note: string | null;
  batchedAt: string;
  createdAt: string;
};

export type PayoutSummary = {
  batches: PayoutBatch[];
  pending: PayoutTotals & {refunded: number};
  settled: PayoutTotals;
};

export async function myPayouts(token: string, limit?: number): Promise<PayoutSummary> {
  return api.post<PayoutSummary>("/payouts/mine", typeof limit === "number" ? {limit} : {}, token);
}
