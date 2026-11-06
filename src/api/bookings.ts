import {api} from "./client";
import type {SepayCheckout} from "./dispatch";

export type BookingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "ARRIVED"
  | "COMPLETED"
  | "NO_SHOW";

export type BookingService = {
  code: string;
  name: string;
  price: number;
};

export type Booking = {
  id: string;
  riderUid: string;
  providerId: string;
  providerName: string;
  providerSnapshot?: {
    lat?: number | null;
    lng?: number | null;
    label?: string | null;
    openHours?: string | null;
  } | null;
  serviceCodes: string[];
  serviceSnapshot?: BookingService[];
  scheduledAt: string;
  slotKey: string;
  status: BookingStatus;
  note: string | null;
  vehicleId: string | null;
  outsideHours: boolean;
  arrivalMode: "SELF" | "TOW";
  origin: {lat: number; lng: number; label?: string | null} | null;
  linkedTicketIds?: string[];
  reminder: {
    mode: string;
    bufferMinutes: number;
    reminderAt: string | null;
    sentAt: string | null;
  } | null;
  depositAmount: number;
  depositStatus: "NONE" | "DUE" | "REQUESTED" | "COLLECTED" | "CONFIRMED" | "APPLIED" | "WAIVED";
  depositCollectedAt: string | null;
  reminderSentAt: string | null;
  confirmedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  ticketId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingSlot = {
  at: string;
  slot: string;
  outsideHours: boolean;
  remaining: number;
};

export type BookingAvailability = {
  providerId: string;
  date: string;
  bookingEnabled: boolean;
  slotMinutes: number;
  capacity: number;
  leadMinutes: number;
  horizonDays: number;
  alwaysOpen: boolean;
  freeForm: boolean;
  depositPolicy: "NONE" | "FIXED" | "PERCENT";
  depositAmount: number;
  depositPercent: number;
  slots: BookingSlot[];
};

export type BookingConfig = {
  slotMinutes: number;
  capacity: number;
  leadMinutes: number;
  horizonDays: number;
  slotMinutesMin: number;
  slotMinutesMax: number;
  capacityMax: number;
  leadMinutesMax: number;
  horizonDaysMax: number;
};

export function bookingAvailability(providerId: string, token: string, date?: string): Promise<BookingAvailability> {
  return api.post<BookingAvailability>("/bookings/availability", {providerId, ...(date ? {date} : {})}, token);
}

export function bookingConfig(token: string): Promise<BookingConfig> {
  return api.post<BookingConfig>("/bookings/config", {}, token);
}

export function createBooking(input: {
  providerId: string;
  scheduledAt: string;
  serviceCodes?: string[];
  note?: string;
  vehicleId?: string;
  arrivalMode?: "SELF" | "TOW";
  origin?: {lat: number; lng: number; label?: string | null};
  bufferMinutes?: number;
}, token: string): Promise<Booking> {
  return api.post<Booking>("/bookings", input, token);
}

export function updateBookingPlan(input: {
  bookingId: string;
  arrivalMode?: "SELF" | "TOW";
  origin?: {lat: number; lng: number; label?: string | null};
  bufferMinutes?: number;
}, token: string): Promise<Booking> {
  return api.post<Booking>("/bookings/update", input, token);
}

export function createBookingTow(bookingId: string, token: string): Promise<{ticket: {id: string}}> {
  return api.post<{ticket: {id: string}}>("/bookings/tow", {bookingId}, token);
}

export function requestBookingDeposit(bookingId: string, token: string): Promise<{booking: Booking}> {
  return api.post<{booking: Booking}>("/bookings/deposit/request", {bookingId}, token);
}

export function depositCheckout(bookingId: string, token: string): Promise<{
  id: string;
  status: string;
  checkout?: SepayCheckout | null;
}> {
  return api.post("/bookings/deposit/checkout", {bookingId}, token);
}

export function respondBooking(bookingId: string, accept: boolean, token: string, reason?: string): Promise<Booking> {
  return api.post<Booking>("/bookings/respond", {bookingId, accept, ...(reason ? {reason} : {})}, token);
}

export function cancelBooking(bookingId: string, token: string, reason?: string): Promise<Booking> {
  return api.post<Booking>("/bookings/cancel", {bookingId, ...(reason ? {reason} : {})}, token);
}

export function arriveBooking(bookingId: string, token: string): Promise<{booking: Booking; ticketId: string}> {
  return api.post<{booking: Booking; ticketId: string}>("/bookings/arrive", {bookingId}, token);
}

export function completeBooking(bookingId: string, token: string): Promise<Booking> {
  return api.post<Booking>("/bookings/complete", {bookingId}, token);
}

export function collectBookingDeposit(bookingId: string, collected: boolean, token: string): Promise<Booking> {
  return api.post<Booking>("/bookings/deposit", {bookingId, collected}, token);
}

export function myBookings(token: string): Promise<{bookings: Booking[]}> {
  return api.post<{bookings: Booking[]}>("/bookings/mine", {}, token);
}

export function shopBookings(providerId: string, token: string): Promise<{bookings: Booking[]}> {
  return api.post<{bookings: Booking[]}>("/bookings/shop", {providerId}, token);
}
