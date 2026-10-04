export type VehicleClass = "SOLO_BIKE" | "CAR";

const CAR_TYPES = new Set(["CAR", "VAN", "TRUCK"]);
const BIKE_TYPES = new Set(["SCOOTER", "CUB", "MANUAL"]);

export function vehicleClassOf(vehicleType: string | null | undefined): VehicleClass | null {
  if (!vehicleType) return null;
  if (CAR_TYPES.has(vehicleType)) return "CAR";
  if (BIKE_TYPES.has(vehicleType)) return "SOLO_BIKE";
  return null;
}
