import {api} from "./client";

export type VehicleType = "SCOOTER" | "CUB" | "MANUAL" | "CAR" | "VAN" | "TRUCK";
export const VEHICLE_DEFAULT_WIDTH: Record<string, number> = {
  SCOOTER: 0.7,
  CUB: 0.7,
  MANUAL: 0.8,
  CAR: 1.9,
  VAN: 2.0,
  TRUCK: 2.3,
};

export type ConfigType = "SOLO" | "PASSENGER" | "CARGO";

export type VehicleProfile = {
  id: string;
  type: string;
  baseWidth: number;
  baseHeight: number;
  towVehicleType?: string | null;
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

export type TowVehicleType = "CAR" | "VAN" | "TRUCK";

export function listProfiles(token: string): Promise<VehicleProfile[]> {
  return api.post<VehicleProfile[]>("/vehicleProfiles/all", {}, token);
}

export function createProfile(payload: CreateProfilePayload, token: string): Promise<VehicleProfile> {
  return api.post<VehicleProfile>("/vehicleProfiles", payload, token);
}

export function addRideConfig(payload: RideConfigPayload, token: string): Promise<{id: string}> {
  return api.post<{id: string}>("/vehicleProfiles/rideConfig", payload, token);
}

export function setTowVehicle(profileId: string, towVehicleType: TowVehicleType | null, token: string): Promise<VehicleProfile> {
  return api.put<VehicleProfile>("/vehicleProfiles/tow", {profileId, towVehicleType}, token);
}
