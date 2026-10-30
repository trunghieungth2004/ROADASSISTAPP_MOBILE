import {api} from "./client";

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
  providerLinks?: Array<{id: string; kind: string; name: string; status: string; plate: string | null; vehicleType: string | null; vehicleWidth: number | null}>;
};

export type CreateProfilePayload = {
  type: VehicleType;
  baseWidth: number;
  baseHeight: number;
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

export function removeProfile(profileId: string, token: string): Promise<{removed: boolean; revokedProviders: string[]}> {
  return api.post<{removed: boolean; revokedProviders: string[]}>("/vehicleProfiles/remove", {profileId}, token);
}

export function addRideConfig(payload: RideConfigPayload, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/vehicleProfiles/rideConfig", payload, token);
}

