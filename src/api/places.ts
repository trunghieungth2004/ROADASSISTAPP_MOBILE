import {api} from "./client";
import {config} from "../config";
import type {Place} from "../components/place-search/PlaceSearch.types";

export type SavedPlace = {
  id: string;
  userId: string;
  label: string;
  lat: number;
  lng: number;
  createdAt?: string;
  updatedAt?: string;
};

type DirectoryHit = {
  kind: "shop" | "landmark";
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type MaptilerFeature = {
  place_name: string;
  center: [number, number];
  text?: string;
};

const MIN_QUERY = 3;
const HCMC_VIEWBOX = "106.35,10.36,106.92,10.94";

export function formatPoint(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function placeKey(p: {lat: number; lng: number}): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

async function maptilerForward(query: string, lang: string): Promise<Place[]> {
  if (!config.maptilerKey) return [];
  const params = new URLSearchParams({
    key: config.maptilerKey,
    language: lang === "vi" ? "vi" : "en",
    country: "vn",
    bbox: HCMC_VIEWBOX,
    limit: "8",
  });
  const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params}`);
  if (!res.ok) return [];
  const body = (await res.json()) as {features?: MaptilerFeature[]};
  return (body.features ?? [])
    .filter((f) => Array.isArray(f.center) && f.center.length >= 2)
    .map((f) => ({
      label: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
      source: "map" as const,
    }));
}

export async function searchMapPlaces(query: string, lang: string): Promise<Place[]> {
  if (query.trim().length < MIN_QUERY) return [];
  try {
    return await maptilerForward(query.trim(), lang);
  } catch {
    return [];
  }
}

export async function reverseLabel(lat: number, lng: number, lang: string): Promise<string> {
  if (!config.maptilerKey) return formatPoint(lat, lng);
  try {
    const params = new URLSearchParams({
      key: config.maptilerKey,
      language: lang === "vi" ? "vi" : "en",
      limit: "1",
    });
    const res = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?${params}`);
    if (!res.ok) return formatPoint(lat, lng);
    const body = (await res.json()) as {features?: MaptilerFeature[]};
    return body.features?.[0]?.place_name ?? formatPoint(lat, lng);
  } catch {
    return formatPoint(lat, lng);
  }
}

export async function searchDirectory(query: string, token: string, limit = 5): Promise<Place[]> {
  if (query.trim().length < MIN_QUERY || !token) return [];
  try {
    const hits = await api.post<DirectoryHit[]>("/places/search", {q: query.trim(), limit}, token);
    return (hits ?? []).map((h) => ({
      label: h.label,
      lat: h.lat,
      lng: h.lng,
      source: "directory" as const,
      id: h.id,
    }));
  } catch {
    return [];
  }
}

export async function savePlace(payload: {label: string; lat: number; lng: number}, token: string): Promise<SavedPlace> {
  return api.post<SavedPlace>("/places/save", payload, token);
}

export async function listSavedPlaces(token: string): Promise<SavedPlace[]> {
  const hits = await api.post<SavedPlace[]>("/places/saved", {}, token);
  return hits ?? [];
}

export async function removeSavedPlace(placeId: string, token: string): Promise<{deleted: number}> {
  return api.post<{deleted: number}>("/places/unsave", {placeId}, token);
}
