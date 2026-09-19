import type { Strings } from "./index";

function pick(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

export function vehicleTypeLabel(value: string, t: Strings): string {
  return pick(t.vehicle.types as Record<string, string>, value);
}

export function configTypeLabel(value: string, t: Strings): string {
  return pick(t.vehicle.configs as Record<string, string>, value);
}

export function flagTypeLabel(value: string, t: Strings): string {
  if (value === "FLOOD") {
    return t.flag.flood;
  }
  if (value === "OBSTRUCTION") {
    return t.flag.obstruction;
  }
  if (value === "ACCIDENT") {
    return t.flag.accident;
  }
  return value;
}

export function tierLabel(value: string, t: Strings): string {
  return pick(t.hazards.tiers as Record<string, string>, value);
}
