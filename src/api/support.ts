import {api} from "./client";

export type SupportCategory = "PAYMENT" | "SAFETY" | "APP" | "PROVIDER" | "OTHER";

export type SupportTicket = {
  id: string;
  userId: string;
  ticketId: string | null;
  category: SupportCategory;
  message: string;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
};

export function createSupportTicket(input: {
  category: SupportCategory;
  message: string;
  ticketId?: string;
}, token: string): Promise<SupportTicket> {
  return api.post<SupportTicket>("/support", input, token);
}

export function mySupportTickets(token: string): Promise<{tickets: SupportTicket[]}> {
  return api.post<{tickets: SupportTicket[]}>("/support/mine", {}, token);
}
