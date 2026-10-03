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
  towPlate?: string | null;
  createdAt?: string;
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

export function nearTickets(lat: number, lng: number, token: string, radiusMeters?: number): Promise<DispatchTicket[]> {
  return api.post<DispatchTicket[]>("/dispatch/near", {lat, lng, radiusMeters}, token);
}

export function acceptTicket(ticketId: string, token: string, shopId?: string): Promise<{matched: boolean; kind: string}> {
  return api.post<{matched: boolean; kind: string}>("/dispatch/accept", {ticketId, shopId}, token);
}

export function updateTicketStatus(ticketId: string, status: string, token: string): Promise<{updated: number}> {
  return api.put<{updated: number}>("/dispatch/status", {ticketId, status}, token);
}
