import {api} from "./client";
import {CACHE_TTL_MS, cacheClear, cacheDel, withCache} from "../services/cache";

export type LatLng = {
  lat: number;
  lng: number;
};

export type RouteRequest = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  stops?: LatLng[];
  width?: number;
  vehicleType?: string;
  mode?: "scooter" | "car" | "foot";
};

export type RouteGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type HazardZone = {
  flagId: string;
  type?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  note?: string | null;
  distanceMeters: number;
};

export type WidthBlock = {
  segmentId: string;
  baseWidth: number;
  distanceMeters: number;
};

export type RouteStep = {
  at: [number, number];
  kind: string;
  street?: string;
  distMeters: number;
  durationSec: number;
};

export type RouteOption = {
  source: string;
  geometry: RouteGeometry;
  distanceMeters?: number;
  durationSeconds?: number;
  hazards?: HazardZone[];
  warnings?: unknown[];
  steps?: RouteStep[];
};

export type RouteResult = {
  cached: boolean;
  routes: RouteOption[];
};

function hasUsableGeometry(value: unknown): value is RouteGeometry {
  if (!value || typeof value !== "object") return false;
  const coords = (value as {coordinates?: unknown}).coordinates;
  return Array.isArray(coords) && coords.length > 0;
}

function normalizeRouteOption(route: RouteOption): RouteOption {
  if (!hasUsableGeometry(route.geometry)) {
    throw new Error("Route has no usable geometry");
  }
  return route;
}

const VEHICLE_TYPES = ["SCOOTER", "CUB", "MANUAL", "CAR", "VAN", "TRUCK"] as const;

export async function findRoute(payload: RouteRequest, token: string): Promise<RouteResult> {
  const {vehicleType, width, ...rest} = payload;
  const result = await api.post<RouteResult>("/routes", {
    ...rest,
    ...(typeof vehicleType === "string" && (VEHICLE_TYPES as readonly string[]).includes(vehicleType) ? {vehicleType} : {}),
    ...(typeof width === "number" && Number.isFinite(width) ? {width} : {}),
  }, token);
  return {...result, routes: (result.routes ?? []).map(normalizeRouteOption)};
}

export type SavedRouteSummary = {
  id: string;
  name?: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  stops?: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
  createdAt?: string;
};

export type SavedRoute = SavedRouteSummary & {
  geometry: RouteGeometry;
  source?: string;
};

export type SaveRoutePayload = {
  name?: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  stops?: LatLng[];
  width?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  source?: string;
  geometry: RouteGeometry;
};

export async function saveRoute(payload: SaveRoutePayload, token: string): Promise<{id: string}> {
  const res = await api.post<{id: string}>("/routes/save", payload, token);
  cacheDel(`savedRoutes:${token}`);
  return res;
}

export function listSavedRoutes(token: string): Promise<SavedRouteSummary[]> {
  return withCache(`savedRoutes:${token}`, CACHE_TTL_MS.savedRoutes, () => api.post<SavedRouteSummary[]>("/routes/saved", {}, token));
}

export function getSavedRoute(routeId: string, token: string): Promise<SavedRoute> {
  return withCache(`savedRoute:${token}:${routeId}`, CACHE_TTL_MS.savedRoute, () => api.post<SavedRoute>("/routes/saved/one", {routeId}, token));
}

export async function renameSavedRoute(routeId: string, name: string, token: string): Promise<{renamed: number}> {
  const res = await api.put<{renamed: number}>("/routes/saved", {routeId, name}, token);
  cacheDel(`savedRoutes:${token}`);
  cacheDel(`savedRoute:${token}:${routeId}`);
  return res;
}

export async function deleteSavedRoute(routeId: string, token: string): Promise<{deleted: number}> {
  const res = await api.post<{deleted: number}>("/routes/unsave", {routeId}, token);
  cacheDel(`savedRoutes:${token}`);
  cacheDel(`savedRoute:${token}:${routeId}`);
  return res;
}

export function invalidateSavedRoutes(token: string): void {
  cacheClear(`savedRoutes:${token}`);
  cacheClear(`savedRoute:${token}:`);
}

export function isHazardZone(e: unknown): e is HazardZone {
  return !!e && typeof e === "object" && "flagId" in (e as Record<string, unknown>) && "radiusMeters" in (e as Record<string, unknown>);
}

export function isWidthBlock(e: unknown): e is WidthBlock {
  return !!e && typeof e === "object" && "segmentId" in (e as Record<string, unknown>) && "baseWidth" in (e as Record<string, unknown>);
}

export type FlagWarning = {
  flagId: string;
  type?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  note?: string | null;
  distanceMeters: number;
};

export function isFlagWarning(e: unknown): e is FlagWarning {
  const r = e as Record<string, unknown>;
  return !!e && typeof e === "object" && typeof r.flagId === "string" && typeof r.distanceMeters === "number" && typeof r.lat === "number" && typeof r.lng === "number" && !("segmentId" in r);
}
