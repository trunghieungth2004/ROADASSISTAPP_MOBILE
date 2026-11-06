import {api} from "./client";

export type RefundRequest = {
  id: string;
  paymentId: string;
  ticketId: string;
  amount: number;
  status: string;
  reason: string | null;
  requestedAt: string;
  transferRef: string | null;
};

export function requestRefund(
  payload: {paymentId: string; amount?: number; reason?: string},
  token: string,
): Promise<RefundRequest> {
  return api.post<RefundRequest>("/refunds/request", payload, token);
}

export function myRefunds(token: string, limit?: number): Promise<RefundRequest[]> {
  return api.post<RefundRequest[]>("/refunds/mine", typeof limit === "number" ? {limit} : {}, token);
}
