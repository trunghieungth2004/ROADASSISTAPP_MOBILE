import {api} from "./client";

export type MeUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  role: string;
  status?: string | null;
  trustScore?: number;
  points?: number;
  volunteerAvailable?: boolean;
  volunteerRadiusKm?: number;
  capability?: string;
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

export function setVolunteerAvailability(payload: {available: boolean; volunteerRadiusKm?: number; capability?: string}, token: string): Promise<{updated: number; available: boolean}> {
  return api.put<{updated: number; available: boolean}>("/users/volunteer", payload, token);
}

export function volunteerHeartbeat(lat: number, lng: number, token: string): Promise<unknown> {
  return api.post<unknown>("/users/volunteer/heartbeat", {lat, lng}, token);
}
