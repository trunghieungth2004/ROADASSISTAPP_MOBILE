export type VehicleButtonState = "ready" | "unselected" | "empty";

export function vehicleButtonState(hasVehicles: boolean, hasActive: boolean): VehicleButtonState {
  if (hasActive) return "ready";
  return hasVehicles ? "unselected" : "empty";
}
