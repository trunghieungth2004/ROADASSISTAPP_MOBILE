import {api} from "./client";

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
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    refundAmount: number | null;
  } | null;
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
  items: BillItem[];
};

export async function myBills(token: string, limit?: number): Promise<Bill[]> {
  return api.post<Bill[]>("/bills/all", typeof limit === "number" ? {limit} : {}, token);
}

export async function fetchBill(token: string, params: {ticketId?: string; billId?: string}): Promise<Bill> {
  return api.post<Bill>("/bills/one", params, token);
}
