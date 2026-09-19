import {api} from "./client";

export type FlagType = "ACCIDENT" | "FLOOD" | "OBSTRUCTION";

export type Flag = {
  id: string;
  type: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  note?: string | null;
  status: string;
  voteCount?: number;
  reporterId?: string;
};

export type SubmitFlagPayload = {
  type: FlagType;
  lat: number;
  lng: number;
  note?: string;
  radiusMeters?: number;
};

export function submitFlag(payload: SubmitFlagPayload, token: string): Promise<{id: string; status: string}> {
  return api.post<{id: string; status: string}>("/flags", payload, token);
}

export function confirmFlag(flagId: string, token: string): Promise<{id: string; voteCount: number; status: string; alreadyVoted?: boolean}> {
  return api.post<{id: string; voteCount: number; status: string; alreadyVoted?: boolean}>("/flags/confirm", {flagId}, token);
}

export function denyFlag(flagId: string, token: string): Promise<{id: string; voteCount: number; status: string; alreadyVoted?: boolean}> {
  return api.post<{id: string; voteCount: number; status: string; alreadyVoted?: boolean}>("/flags/deny", {flagId}, token);
}

export function unflag(flagId: string, token: string): Promise<{unflagged: number}> {
  return api.post<{unflagged: number}>("/flags/unflag", {flagId}, token);
}

export function flagsNear(lat: number, lng: number, radiusMeters: number, token: string): Promise<Flag[]> {
  return api.post<Flag[]>("/flags/near", {lat, lng, radiusMeters}, token);
}

export function myFlags(token: string): Promise<Flag[]> {
  return api.post<Flag[]>("/flags/mine", {}, token);
}
