import {api} from "./client";
import type {Provider} from "./providers";

export type VehicleType = "BIKE" | "CAR";

export function normalizeVehicleType(value: unknown): VehicleType | null {
  if (value === "CAR" || value === "VAN" || value === "TRUCK") return "CAR";
  if (value === "BIKE" || value === "SCOOTER" || value === "CUB" || value === "MANUAL") return "BIKE";
  return null;
}
export const VEHICLE_DEFAULT_WIDTH: Record<string, number> = {
  BIKE: 0.7,
  CAR: 1.9,
};

export type ConfigType = "SOLO" | "PASSENGER" | "CARGO";

export type VehicleProfile = {
  id: string;
  type: string;
  baseWidth: number;
  baseHeight: number;
  label?: string | null;
  plate?: string | null;
  providerLinks?: Array<{id: string; kind: string; name: string; status: string; plate: string | null; vehicleType: string | null; vehicleWidth: number | null}>;
};

export type CreateProfilePayload = {
  type: VehicleType;
  baseWidth: number;
  baseHeight: number;
  label?: string;
  plate?: string;
};

export type UpdateProfilePayload = {
  profileId: string;
  label?: string;
  plate?: string;
  baseWidth?: number;
  baseHeight?: number;
};

export type VehicleHistoryLine = {
  lineId: string;
  serviceCode: string;
  name: string;
  qty: number;
  amount: number;
  warrantyUntil: string | null;
  claim: {
    id: string;
    status: string;
    shopResponse: string | null;
    linkedTicketId: string | null;
    refundAmount: number | null;
    refundRequestId: string | null;
    createdAt: string;
  } | null;
};

export type VehicleHistoryItem = {
  ticketId: string;
  ticketType: string;
  serviceDate: string | null;
  providerName: string | null;
  provider?: Provider | null;
  total: number;
  lines: VehicleHistoryLine[];
};

export type VehicleHistory = {
  profileId: string;
  items: VehicleHistoryItem[];
};

export type RideConfigPayload = {
  profileId: string;
  configType: ConfigType;
  estWidth?: number;
  estHeight?: number;
};


export function listProfiles(token: string): Promise<VehicleProfile[]> {
  return api.post<VehicleProfile[]>("/vehicleProfiles/all", {}, token);
}

export function createProfile(payload: CreateProfilePayload, token: string): Promise<VehicleProfile> {
  return api.post<VehicleProfile>("/vehicleProfiles", payload, token);
}

export function updateProfile(payload: UpdateProfilePayload, token: string): Promise<VehicleProfile> {
  return api.post<VehicleProfile>("/vehicleProfiles/update", payload, token);
}

export function vehicleHistory(profileId: string, token: string, limit?: number): Promise<VehicleHistory> {
  return api.post<VehicleHistory>("/vehicleProfiles/history", {
    profileId,
    ...(typeof limit === "number" ? {limit} : {}),
  }, token);
}

export function removeProfile(profileId: string, token: string): Promise<{removed: boolean; revokedProviders: string[]}> {
  return api.post<{removed: boolean; revokedProviders: string[]}>("/vehicleProfiles/remove", {profileId}, token);
}

export function addRideConfig(payload: RideConfigPayload, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/vehicleProfiles/rideConfig", payload, token);
}

