import {api} from "./client";

export type TicketType = "SOS" | "TOW" | "MECHANIC";

export type DispatchTicket = {
  id: string;
  userId: string;
  ticketType: string;
  lat: number;
  lng: number;
  note?: string | null;
  status: string;
  vehicleType?: string | null;
  destinationShopId?: string | null;
  destinationPoint?: {lat: number; lng: number; label?: string} | null;
  assignedUid?: string | null;
  assignedShopId?: string | null;
  assignedKind?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export type CreateTicketPayload = {
  ticketType: TicketType;
  lat: number;
  lng: number;
  note?: string;
  destinationShopId?: string;
  destinationPoint?: {lat: number; lng: number; label?: string};
  vehicleType?: string;
  vehicleWidth?: number;
};

export function createTicket(payload: CreateTicketPayload, token: string): Promise<DispatchTicket> {
  return api.post<DispatchTicket>("/dispatch", payload, token);
}

export function myTickets(token: string): Promise<DispatchTicket[]> {
  return api.post<DispatchTicket[]>("/dispatch/mine", {}, token);
}

export function getTicket(ticketId: string, token: string): Promise<DispatchTicket> {
  return api.post<DispatchTicket>("/dispatch/one", {ticketId}, token);
}

export function cancelTicket(ticketId: string, token: string): Promise<{updated: number}> {
  return api.put<{updated: number}>("/dispatch/status", {ticketId, status: "5"}, token);
}

export function updateTicketDestination(payload: {ticketId: string; destinationShopId?: string; destinationPoint?: {lat: number; lng: number; label?: string}}, token: string): Promise<DispatchTicket> {
  return api.post<DispatchTicket>("/dispatch/destination", payload, token);
}
