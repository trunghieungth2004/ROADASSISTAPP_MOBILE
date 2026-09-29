import type {Strings} from "../i18n/en";

export function vehicleTypeName(type: string, t: Strings): string {
  return t.vehicle.types[type as keyof typeof t.vehicle.types] ?? type;
}

export function vehicleMeta(width: number, height: number, tow: string | null | undefined, t: Strings): string {
  const dims = `${width} × ${height} m`;
  if (!tow) return dims;
  return `${dims} · ${t.vehicle.towVehicle}: ${vehicleTypeName(tow, t)}`;
}
