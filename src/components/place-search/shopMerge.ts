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
  return {label: shop.name, lat: shop.lat, lng: shop.lng, source: "shop", id: shop.id, category: "repair"};
}

export async function fetchShopPlaces(
  query: string,
  token: string,
  gps: {lat: number; lng: number},
  vehicleClass?: string,
  radiusMeters?: number,
): Promise<ShopEntry[]> {
  const shops = await searchProviders(gps.lat, gps.lng, query, token, {
    ...(vehicleClass ? {vehicleClass} : {}),
    ...(radiusMeters ? {radiusMeters} : {}),
  });
  return shops.map((s) => ({id: s.id, name: s.name, lat: s.lat, lng: s.lng}));
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
