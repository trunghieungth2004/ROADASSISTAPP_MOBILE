import {api} from "./client";

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
};

export type BillItem = {
  kind: string;
  ticketId: string;
  ticketType: string;
  ticketStatus: string;
  amount: number;
  waitingFee: number;
  status: string;
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
  return api.post<Bill[]>("/bills/payee", typeof limit === "number" ? {limit} : {}, token);
}

export async function fetchBill(token: string, params: {ticketId?: string; billId?: string; scope?: "payee"}): Promise<Bill> {
  return api.post<Bill>("/bills/one", params, token);
}
