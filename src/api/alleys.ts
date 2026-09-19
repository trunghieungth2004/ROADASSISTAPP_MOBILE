import {api} from "./client";

export type Tier = "TIER1" | "TIER2" | "TIER3";

export type AlleySegment = {
  id: string;
  lat: number;
  lng: number;
  baseWidth: number;
  wireHeight?: number;
  inclinePct?: number;
  tier: string;
  verifiedCount?: number;
};

export type SubmitAlleyPayload = {
  lat: number;
  lng: number;
  baseWidth: number;
  tier: Tier;
};

export function alleysNear(lat: number, lng: number, radiusMeters: number, token: string): Promise<AlleySegment[]> {
  return api.post<AlleySegment[]>("/alleys/near", {lat, lng, radiusMeters}, token);
}

export function submitAlley(payload: SubmitAlleyPayload, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/alleys", payload, token);
}
