import {distBetween} from "../../screens/navigation/navUtils";
import {searchProviders, type ServiceCategory} from "../../api/providers";
import type {Place} from "./PlaceSearch.types";

export const SHOP_DUPLICATE_RADIUS_M = 150;
export const MAP_SHOP_LIMIT = 5;

export type ShopEntry = {
  id: string;
  kind?: "SHOP" | "TOW" | "MOBILE_SHOP" | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  distanceMeters?: number | null;
  distance?: number | null;
  declined?: boolean | null;
  openNow?: boolean | null;
  accepting?: boolean | null;
  bookingEnabled?: boolean | null;
  estimatedServicePrice?: number | null;
  estimatedTravelFee?: number | null;
  estimatedTotal?: number | null;
  pricingMode?: "FIXED" | "QUOTE" | "SERVICE_FEE" | null;
  matchedServiceCode?: string | null;
  matchedServiceName?: string | null;
  estimatedDistanceKm?: number | null;
  services?: Array<{code: string; name: string; displayPrice: number; quoteRequired: boolean; channels?: Array<"BOOKING" | "ASSIST">}> | null;
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

export function dropNearDuplicates(
  places: Place[],
  radiusM = SHOP_DUPLICATE_RADIUS_M,
): Place[] {
  const out: Place[] = [];
  for (const place of places) {
    const wanted = normalizeShopName(place.label);
    const duplicate = out.some((other) => {
      if (place.providerKind !== undefined && place.providerKind !== null &&
        other.providerKind !== undefined && other.providerKind !== null &&
        place.providerKind !== other.providerKind) {
        return false;
      }
      if (!sameShop(normalizeShopName(other.label), wanted)) return false;
      return distBetween(
        {lat: place.lat, lng: place.lng},
        {lat: other.lat, lng: other.lng},
      ) <= radiusM;
    });
    if (!duplicate) out.push(place);
  }
  return out;
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
    ...(typeof shop.accepting === "boolean" ? {accepting: shop.accepting} : {}),
    ...(typeof shop.bookingEnabled === "boolean" ? {bookingEnabled: shop.bookingEnabled} : {}),
    ...(typeof shop.estimatedServicePrice === "number" ? {estimatedServicePrice: shop.estimatedServicePrice} : shop.estimatedServicePrice === null ? {estimatedServicePrice: null} : {}),
    ...(typeof shop.estimatedTravelFee === "number" ? {estimatedTravelFee: shop.estimatedTravelFee} : shop.estimatedTravelFee === null ? {estimatedTravelFee: null} : {}),
    ...(typeof shop.estimatedTotal === "number" ? {estimatedTotal: shop.estimatedTotal} : shop.estimatedTotal === null ? {estimatedTotal: null} : {}),
    ...(typeof shop.estimatedDistanceKm === "number" ? {estimatedDistanceKm: shop.estimatedDistanceKm} : shop.estimatedDistanceKm === null ? {estimatedDistanceKm: null} : {}),
    ...(shop.pricingMode !== undefined ? {pricingMode: shop.pricingMode} : {}),
    ...(shop.matchedServiceCode !== undefined ? {matchedServiceCode: shop.matchedServiceCode} : {}),
    ...(shop.matchedServiceName !== undefined ? {matchedServiceName: shop.matchedServiceName} : {}),
    ...(Array.isArray(shop.services) ? {services: shop.services} : {}),
    ...(shop.kind ? {providerKind: shop.kind} : {}),
  };
}

export type ShopSearchFilters = {
  minRating?: number;
  sortBy?: "distance" | "rating" | "price";
  ticketId?: string;
  serviceCategory?: string;
  acceptingOnly?: boolean;
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
    ...(filters?.serviceCategory ? {serviceCategory: filters.serviceCategory as ServiceCategory} : {}),
  });
  return shops
    .filter((s) => !shopOnly || s.kind === "SHOP")
    .filter((s) => filters?.acceptingOnly !== true || s.accepting !== false)
    .map((s) => ({
      id: s.id,
      ...(s.kind ? {kind: s.kind} : {}),
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      ...(typeof s.ratingAvg === "number" ? {ratingAvg: s.ratingAvg} : {}),
      ...(typeof s.ratingCount === "number" ? {ratingCount: s.ratingCount} : {}),
      ...(typeof s.distanceMeters === "number" ? {distanceMeters: s.distanceMeters} : typeof s.distance === "number" ? {distanceMeters: s.distance} : {}),
      ...(typeof s.distance === "number" ? {distance: s.distance} : {}),
      ...(s.declined === true ? {declined: true} : {}),
      ...(typeof s.openNow === "boolean" ? {openNow: s.openNow} : {}),
      ...(typeof s.accepting === "boolean" ? {accepting: s.accepting} : {}),
      ...(typeof s.bookingEnabled === "boolean" ? {bookingEnabled: s.bookingEnabled} : {}),
      ...(typeof s.estimatedServicePrice === "number" ? {estimatedServicePrice: s.estimatedServicePrice} : s.estimatedServicePrice === null ? {estimatedServicePrice: null} : {}),
      ...(typeof s.estimatedTravelFee === "number" ? {estimatedTravelFee: s.estimatedTravelFee} : s.estimatedTravelFee === null ? {estimatedTravelFee: null} : {}),
      ...(typeof s.estimatedTotal === "number" ? {estimatedTotal: s.estimatedTotal} : s.estimatedTotal === null ? {estimatedTotal: null} : {}),
      ...(typeof s.estimatedDistanceKm === "number" ? {estimatedDistanceKm: s.estimatedDistanceKm} : s.estimatedDistanceKm === null ? {estimatedDistanceKm: null} : {}),
      ...(s.pricingMode !== undefined ? {pricingMode: s.pricingMode} : {}),
      ...(s.matchedServiceCode !== undefined ? {matchedServiceCode: s.matchedServiceCode} : {}),
      ...(s.matchedServiceName !== undefined ? {matchedServiceName: s.matchedServiceName} : {}),
      ...(Array.isArray(s.services) ? {services: s.services} : {}),
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
