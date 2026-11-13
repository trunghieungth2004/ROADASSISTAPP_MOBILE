import {api} from "./client";

export type MeUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  role: string;
  status?: string | null;
  trustScore?: number;
  standingScore?: number;
  bookingBlocked?: boolean;
  restrictedUntil?: string | null;
  restrictionReason?: string | null;
  conductFlag?: boolean;
  points?: number;
  ratingAvg?: number;
  ratingCount?: number;
  onboarded?: boolean;
  services?: string[];
};

export type MeVehicle = {
  id: string;
  type: string;
  baseWidth: number;
  baseHeight: number;
  providerLinks?: Array<{id: string; kind: string; name: string; status: string; plate: string | null; vehicleType: string | null; vehicleWidth: number | null}>;
};

export type MeBundle = {
  user: MeUser;
  vehicles: MeVehicle[];
  activeVehicle: MeVehicle | null;
};

export type OnboardResult = {
  updated: number;
  onboarded: boolean;
  services: string[];
};

export function fetchMeBundle(token: string): Promise<MeBundle> {
  return api.post<MeBundle>("/users/me", {}, token);
}

export function setOnboarded(payload: {service: string}, token: string): Promise<OnboardResult> {
  return api.put<OnboardResult>("/users/onboard", payload, token);
}

export function updateUserServices(payload: {targetUserId: string; grant?: string[]; revoke?: string[]}, token: string): Promise<OnboardResult> {
  return api.put<OnboardResult>("/users/services", payload, token);
}

export function setActiveVehicle(payload: {profileId: string | null}, token: string): Promise<{updated: number; profileId: string | null}> {
  return api.put<{updated: number; profileId: string | null}>("/users/activeVehicle", payload, token);
}

export function updateProfile(payload: {displayName: string}, token: string): Promise<{updated: number}> {
  return api.put<{updated: number}>("/users/profile", payload, token);
}
