import type {Strings} from "../../i18n/en";

export function vehicleTypeName(type: string, t: Strings): string {
  if (type === "CAR" || type === "VAN" || type === "TRUCK") return t.vehicle.types.CAR;
  if (type === "BIKE" || type === "SCOOTER" || type === "CUB" || type === "MANUAL") return t.vehicle.types.BIKE;
  return type;
}

export function vehicleMeta(width: number, height: number): string {
  return `${width} × ${height} m`;
}
