import {api} from "./client";

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
  distanceMeters: number;
  durationSeconds: number;
  hazards?: HazardZone[];
  warnings?: unknown[];
  steps?: RouteStep[];
};

export type RouteResult = {
  cached: boolean;
  routes: RouteOption[];
};

export function findRoute(payload: RouteRequest, token: string): Promise<RouteResult> {
  return api.post<RouteResult>("/routes", payload, token);
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
  geometry?: RouteGeometry;
};

export function saveRoute(payload: SaveRoutePayload, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/routes/save", payload, token);
}

export function listSavedRoutes(token: string): Promise<SavedRouteSummary[]> {
  return api.post<SavedRouteSummary[]>("/routes/saved", {}, token);
}

export function getSavedRoute(routeId: string, token: string): Promise<SavedRoute> {
  return api.post<SavedRoute>("/routes/saved/one", {routeId}, token);
}

export function renameSavedRoute(routeId: string, name: string, token: string): Promise<{updated: number}> {
  return api.put<{updated: number}>("/routes/saved", {routeId, name}, token);
}

export function deleteSavedRoute(routeId: string, token: string): Promise<{deleted: number}> {
  return api.post<{deleted: number}>("/routes/unsave", {routeId}, token);
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
