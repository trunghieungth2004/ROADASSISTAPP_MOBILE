import {api} from "./client";

export type Shop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  openHours?: string | null;
  accepting?: boolean;
  distance?: number;
  openNow?: boolean | null;
  ratingAvg?: number;
  ratingCount?: number;
  [key: string]: unknown;
};

export type NearShopsOptions = {
  radiusMeters?: number;
  type?: string;
  acceptingOnly?: boolean;
  openOnly?: boolean;
  limit?: number;
};

export function nearShops(lat: number, lng: number, token: string, options?: NearShopsOptions): Promise<Shop[]> {
  return api.post<Shop[]>("/shops/near", {lat, lng, ...options}, token);
}

export function myShops(token: string): Promise<Shop[]> {
  return api.post<Shop[]>("/shops/mine", {}, token);
}

export type CreateShopPayload = {
  name: string;
  lat: number;
  lng: number;
  type: string;
  openHours?: string;
  hasTow?: boolean;
  towVehicleType?: string;
  towVehicleWidth?: number;
};

export function createShop(payload: CreateShopPayload, token: string): Promise<Shop> {
  return api.post<Shop>("/shops", payload, token);
}

export type UpdateShopPayload = {
  shopId: string;
  name?: string;
  openHours?: string | null;
  accepting?: boolean;
  hasTow?: boolean;
  towVehicleType?: string | null;
  towVehicleWidth?: number | null;
};

export function updateShop(payload: UpdateShopPayload, token: string): Promise<{updated: number}> {
  return api.put<{updated: number}>("/shops", payload, token);
}
