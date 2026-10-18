import {distBetween} from "../../screens/navigation/navUtils";
import {searchProviders} from "../../api/providers";
import type {Place} from "./PlaceSearch.types";

export const SHOP_DUPLICATE_RADIUS_M = 150;
export const MAP_SHOP_LIMIT = 5;

export type ShopEntry = {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  distanceMeters?: number | null;
  distance?: number | null;
  declined?: boolean | null;
  openNow?: boolean | null;
};

export function normalizeShopName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameShop(a: string, b: string): boolean {
  if (a === "" || b === "") return false;
  return a.includes(b) || b.includes(a);
}

function isRepairCategory(category: string | undefined): boolean {
  if (!category) return false;
  const lowered = category.toLowerCase();
  return lowered.includes("repair") || lowered === "motorcycle";
}

export function isRepairPlace(place: Place): boolean {
  return isRepairCategory(place.category);
}

export function filterRepairPlaces(places: Place[]): Place[] {
  return places.filter(isRepairPlace);
}

export function dropShopDuplicates(
  places: Place[],
  shops: ShopEntry[],
  radiusM = SHOP_DUPLICATE_RADIUS_M,
): Place[] {
  return places.filter((place) => {
    const wanted = normalizeShopName(place.label);
    const duplicate = shops.some((shop) => {
      if (!sameShop(normalizeShopName(shop.name), wanted)) return false;
      if (typeof shop.lat !== "number" || typeof shop.lng !== "number") return true;
      return distBetween({lat: shop.lat, lng: shop.lng}, {lat: place.lat, lng: place.lng}) <= radiusM;
    });
    return !duplicate;
  });
}

export function toShopPlace(shop: ShopEntry & {lat: number; lng: number}): Place {
  return {
    label: shop.name,
    lat: shop.lat,
    lng: shop.lng,
    source: "shop",
    id: shop.id,
    category: "repair",
    ...(typeof shop.ratingAvg === "number" ? {ratingAvg: shop.ratingAvg} : {}),
    ...(typeof shop.ratingCount === "number" ? {ratingCount: shop.ratingCount} : {}),
    ...(typeof shop.distanceMeters === "number" ? {distanceMeters: shop.distanceMeters} : typeof shop.distance === "number" ? {distanceMeters: shop.distance} : {}),
    ...(typeof shop.distance === "number" ? {distance: shop.distance} : {}),
    ...(shop.declined === true ? {declined: true} : {}),
    ...(typeof shop.openNow === "boolean" ? {openNow: shop.openNow} : {}),
  };
}

export type ShopSearchFilters = {
  minRating?: number;
  sortBy?: "distance" | "rating";
  ticketId?: string;
};

export async function fetchShopPlaces(
  query: string,
  token: string,
  gps: {lat: number; lng: number},
  vehicleClass?: string,
  radiusMeters?: number,
  shopOnly = false,
  filters?: ShopSearchFilters,
): Promise<ShopEntry[]> {
  const shops = await searchProviders(gps.lat, gps.lng, query, token, {
    ...(shopOnly ? {kind: "SHOP"} : {}),
    ...(vehicleClass ? {vehicleClass} : {}),
    ...(radiusMeters ? {radiusMeters} : {}),
    ...(filters?.minRating !== undefined ? {minRating: filters.minRating} : {}),
    ...(filters?.sortBy ? {sortBy: filters.sortBy} : {}),
    ...(filters?.ticketId ? {ticketId: filters.ticketId} : {}),
  });
  return shops
    .filter((s) => !shopOnly || s.kind === "SHOP")
    .map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      ...(typeof s.ratingAvg === "number" ? {ratingAvg: s.ratingAvg} : {}),
      ...(typeof s.ratingCount === "number" ? {ratingCount: s.ratingCount} : {}),
      ...(typeof s.distanceMeters === "number" ? {distanceMeters: s.distanceMeters} : typeof s.distance === "number" ? {distanceMeters: s.distance} : {}),
      ...(typeof s.distance === "number" ? {distance: s.distance} : {}),
      ...(s.declined === true ? {declined: true} : {}),
      ...(typeof s.openNow === "boolean" ? {openNow: s.openNow} : {}),
    }));
}

export function mergeShopResults(
  shops: ShopEntry[],
  places: Place[],
  origin: {lat: number; lng: number} | null,
  limit = MAP_SHOP_LIMIT,
): Place[] {
  const filtered = dropShopDuplicates(filterRepairPlaces(places), shops);
  const withDistance = filtered.map((p) => ({
    place: p,
    distanceM: origin ? Math.round(distBetween(origin, {lat: p.lat, lng: p.lng})) : null,
  }));
  withDistance.sort((a, b) => (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER));
  return withDistance.slice(0, limit).map((w) => w.place);
}
