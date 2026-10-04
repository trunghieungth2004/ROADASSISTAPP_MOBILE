import {api} from "./client";
import {CACHE_TTL_MS, cacheClear, cacheDel, withCache} from "../services/cache";

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
  vehicleClasses?: string[] | null;
  accepting?: boolean;
  plate?: string | null;
  plateRaw?: string | null;
  vehicleType?: string | null;
  vehicleWidth?: number | null;
  serviceFee?: number | null;
  towBaseFee?: number | null;
  towPerKmFee?: number | null;
  status: ProviderStatus;
  suspended?: boolean;
  suspendedReason?: string | null;
  distance?: number;
  openNow?: boolean | null;
  closesInMinutes?: number | null;
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
  vehicleClass?: string;
  limit?: number;
};

export function nearProviders(lat: number, lng: number, token: string, options?: NearProvidersOptions): Promise<Provider[]> {
  const key = `providersNear:${token}:${lat.toFixed(3)},${lng.toFixed(3)},${options?.kind ?? "-"},${options?.radiusMeters ?? "-"},${options?.acceptingOnly === true ? "1" : "0"},${options?.openOnly === true ? "1" : "0"},${options?.vehicleClass ?? "-"},${options?.limit ?? "-"}`;
  return withCache(key, CACHE_TTL_MS.providersNear, () => api.post<Provider[]>("/providers/near", {lat, lng, ...options}, token));
}

export type SearchProvidersOptions = {
  vehicleClass?: string;
  radiusMeters?: number;
  limit?: number;
};

export function searchProviders(lat: number, lng: number, query: string, token: string, options?: SearchProvidersOptions): Promise<Provider[]> {
  const key = `providersSearch:${token}:${lat.toFixed(3)},${lng.toFixed(3)},${query.trim().toLowerCase()},${options?.vehicleClass ?? "-"},${options?.radiusMeters ?? "-"},${options?.limit ?? "-"}`;
  return withCache(key, CACHE_TTL_MS.providersNear, () => api.post<Provider[]>("/providers/search", {lat, lng, query, ...options}, token));
}

export type ProviderRating = {
  id: string;
  score: number;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt?: string;
};

export type ProviderRatings = {
  ratings: ProviderRating[];
  avg: number;
  count: number;
};

export function providerRatings(providerId: string, token: string): Promise<ProviderRatings> {
  return api.post<ProviderRatings>("/providers/ratings", {providerId}, token);
}

export function myProviders(token: string): Promise<Provider[]> {
  return withCache(`providersMine:${token}`, CACHE_TTL_MS.providersMine, () => api.post<Provider[]>("/providers/mine", {}, token));
}

export type CreateShopProviderPayload = {
  kind: "SHOP";
  name: string;
  lat: number;
  lng: number;
  label?: string;
  openHours?: string;
  vehicleClasses?: string[];
  serviceFee?: number;
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
  towBaseFee?: number;
  towPerKmFee?: number;
};

export async function createProvider(payload: CreateShopProviderPayload | CreateTowProviderPayload, token: string): Promise<Provider> {
  const created = await api.post<Provider>("/providers", payload, token);
  cacheDel(`providersMine:${token}`);
  cacheClear(`providersNear:${token}:`);
  return created;
}

export type UpdateProviderPayload = {
  providerId: string;
  name?: string;
  label?: string | null;
  lat?: number;
  lng?: number;
  openHours?: string | null;
  vehicleClasses?: string[];
  serviceFee?: number;
  towBaseFee?: number;
  towPerKmFee?: number;
  accepting?: boolean;
};

export async function updateProvider(payload: UpdateProviderPayload, token: string): Promise<{updated: number}> {
  const res = await api.put<{updated: number}>("/providers", payload, token);
  cacheDel(`providersMine:${token}`);
  cacheClear(`providersNear:${token}:`);
  return res;
}

export type ReportReason = "FAKE_BUSINESS" | "WRONG_LOCATION" | "UNSAFE" | "HARASSMENT" | "SPAM" | "INFO_INACCURATE" | "OTHER";

export const REPORT_REASONS: ReportReason[] = ["FAKE_BUSINESS", "WRONG_LOCATION", "UNSAFE", "HARASSMENT", "SPAM", "INFO_INACCURATE", "OTHER"];

export function reportProvider(payload: {providerId: string; reason: ReportReason; note?: string; ticketId?: string}, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/providers/report", payload, token);
}

export function pingProviderLocation(lat: number, lng: number, token: string): Promise<{updated: number; providerId: string}> {
  return api.post<{updated: number; providerId: string}>("/providers/location", {lat, lng}, token);
}
