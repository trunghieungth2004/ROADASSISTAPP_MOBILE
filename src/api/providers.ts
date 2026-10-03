import {api} from "./client";

export type ProviderKind = "SHOP" | "TOW";
export type ProviderStatus = "ACTIVE" | "PENDING" | "DENIED";

export type Provider = {
  id: string;
  kind: ProviderKind;
  operatorUid?: string | null;
  name: string;
  lat: number;
  lng: number;
  label?: string | null;
  openHours?: string | null;
  accepting?: boolean;
  plate?: string | null;
  plateRaw?: string | null;
  vehicleType?: string | null;
  vehicleWidth?: number | null;
  status: ProviderStatus;
  suspended?: boolean;
  suspendedReason?: string | null;
  distance?: number;
  openNow?: boolean | null;
  live?: boolean;
  fitsAlley?: boolean | null;
  ratingAvg?: number;
  ratingCount?: number;
  reviewNote?: string | null;
};

export type NearProvidersOptions = {
  kind?: string;
  radiusMeters?: number;
  acceptingOnly?: boolean;
  openOnly?: boolean;
  limit?: number;
};

export function nearProviders(lat: number, lng: number, token: string, options?: NearProvidersOptions): Promise<Provider[]> {
  return api.post<Provider[]>("/providers/near", {lat, lng, ...options}, token);
}

export function myProviders(token: string): Promise<Provider[]> {
  return api.post<Provider[]>("/providers/mine", {}, token);
}

export type CreateShopProviderPayload = {
  kind: "SHOP";
  name: string;
  lat: number;
  lng: number;
  label?: string;
  openHours?: string;
};

export type CreateTowProviderPayload = {
  kind: "TOW";
  name: string;
  lat: number;
  lng: number;
  label?: string;
  plate: string;
  vehicleType: string;
  vehicleWidth?: number;
};

export function createProvider(payload: CreateShopProviderPayload | CreateTowProviderPayload, token: string): Promise<Provider> {
  return api.post<Provider>("/providers", payload, token);
}

export type UpdateProviderPayload = {
  providerId: string;
  name?: string;
  label?: string | null;
  lat?: number;
  lng?: number;
  openHours?: string | null;
  accepting?: boolean;
};

export function updateProvider(payload: UpdateProviderPayload, token: string): Promise<{updated: number}> {
  return api.put<{updated: number}>("/providers", payload, token);
}

export type ReportReason = "FAKE_BUSINESS" | "WRONG_LOCATION" | "UNSAFE" | "HARASSMENT" | "SPAM" | "OTHER";

export const REPORT_REASONS: ReportReason[] = ["FAKE_BUSINESS", "WRONG_LOCATION", "UNSAFE", "HARASSMENT", "SPAM", "OTHER"];

export function reportProvider(payload: {providerId: string; reason: ReportReason; note?: string; ticketId?: string}, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/providers/report", payload, token);
}

export function pingProviderLocation(lat: number, lng: number, token: string): Promise<{updated: number; providerId: string}> {
  return api.post<{updated: number; providerId: string}>("/providers/location", {lat, lng}, token);
}
