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
  createdAt?: string;
  ttlExpiresAtMs?: number | null;
};

export const FLAG_CONSENSUS_THRESHOLD = 3;

type FlagWire = {
  id: string;
  type: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  note?: string | null;
  status: string;
  voteCount?: number;
  reporterId?: string;
  reporterUid?: string;
  createdAt?: string;
  ttlExpiresAt?: {_seconds?: number; _nanoseconds?: number} | string | number | null;
};

function ttlMsOf(value: FlagWire["ttlExpiresAt"]): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const at = Date.parse(value);
    return Number.isNaN(at) ? null : at;
  }
  if (typeof value === "object") {
    const s = value._seconds;
    if (typeof s !== "number" || !Number.isFinite(s)) return null;
    const ns = typeof value._nanoseconds === "number" ? value._nanoseconds : 0;
    return s * 1000 + Math.floor(ns / 1e6);
  }
  return null;
}

export function toFlag(raw: FlagWire): Flag {  return {
    id: raw.id,
    type: raw.type,
    lat: raw.lat,
    lng: raw.lng,
    radiusMeters: raw.radiusMeters,
    note: raw.note,
    status: raw.status,
    voteCount: raw.voteCount,
    reporterId: raw.reporterId ?? raw.reporterUid,
    createdAt: raw.createdAt,
    ttlExpiresAtMs: ttlMsOf(raw.ttlExpiresAt),
  };
}

export function isExpired(flag: Pick<Flag, "ttlExpiresAtMs">, nowMs: number): boolean {
  return flag.ttlExpiresAtMs !== undefined && flag.ttlExpiresAtMs !== null && flag.ttlExpiresAtMs <= nowMs;
}

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

export async function flagsNear(lat: number, lng: number, radiusMeters: number, token: string): Promise<Flag[]> {
  const list = await api.post<FlagWire[]>("/flags/near", {lat, lng, radiusMeters}, token);
  const now = Date.now();
  return list.map(toFlag).filter((flag) => !isExpired(flag, now));
}

export async function getFlag(flagId: string, token: string): Promise<Flag | null> {
  const flag = toFlag(await api.post<FlagWire>("/flags/get", {flagId}, token));
  return isExpired(flag, Date.now()) ? null : flag;
}

export async function myFlags(token: string): Promise<Flag[]> {
  const list = await api.post<FlagWire[]>("/flags/mine", {}, token);
  const now = Date.now();
  return list.map(toFlag).filter((flag) => !isExpired(flag, now));
}
