import type {Provider, ProviderKind} from "../../api/providers";
import {normalizeVehicleType} from "../../api/vehicles";
import type {MeVehicle} from "../../api/users";

export type ExistingVehicleChoice = {
  plate: string;
  vehicleType: "BIKE" | "CAR";
  vehicleWidth: number | null;
  vehicleHeight: number | null;
  label: string | null;
  kind: ProviderKind | "PROFILE";
  status: string | null;
};

export function plateKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function existingVehicleChoices(
  kind: "SHOP" | "TOW" | "MOBILE_SHOP",
  currentProviderId: string | null,
  providers: Provider[],
  vehicles: MeVehicle[],
): ExistingVehicleChoice[] {
  if (kind === "SHOP") return [];
  const out = new Map<string, ExistingVehicleChoice>();
  const compatible = (type: "BIKE" | "CAR" | null): boolean =>
    type !== null && (kind === "MOBILE_SHOP" || type === "CAR");
  for (const provider of providers) {
    if (provider.id === currentProviderId) continue;
    if (provider.kind !== "TOW" && provider.kind !== "MOBILE_SHOP") continue;
    if (provider.kind === kind && provider.status !== "DENIED") continue;
    if (typeof provider.plate !== "string" || provider.plate.trim() === "") continue;
    const type = normalizeVehicleType(provider.vehicleType);
    if (!compatible(type) || type === null) continue;
    const key = plateKey(provider.plate);
    if (key === "" || out.has(key)) continue;
    out.set(key, {
      plate: provider.plate,
      vehicleType: type,
      vehicleWidth: typeof provider.vehicleWidth === "number" ? provider.vehicleWidth : null,
      vehicleHeight: typeof provider.vehicleHeight === "number" ? provider.vehicleHeight : null,
      label: typeof provider.vehicleLabel === "string" && provider.vehicleLabel.trim() !== "" ?
        provider.vehicleLabel :
        null,
      kind: provider.kind,
      status: provider.status,
    });
  }
  for (const vehicle of vehicles) {
    if (typeof vehicle.plate !== "string" || vehicle.plate.trim() === "") continue;
    const type = normalizeVehicleType(vehicle.type);
    if (!compatible(type) || type === null) continue;
    const key = plateKey(vehicle.plate);
    if (key === "") continue;
    const found = out.get(key);
    if (found) {
      if (found.label === null && typeof vehicle.label === "string" && vehicle.label.trim() !== "") {
        found.label = vehicle.label;
      }
      if (found.vehicleWidth === null && typeof vehicle.baseWidth === "number") {
        found.vehicleWidth = vehicle.baseWidth;
      }
      if (found.vehicleHeight === null && typeof vehicle.baseHeight === "number") {
        found.vehicleHeight = vehicle.baseHeight;
      }
      continue;
    }
    out.set(key, {
      plate: vehicle.plate,
      vehicleType: type,
      vehicleWidth: typeof vehicle.baseWidth === "number" ? vehicle.baseWidth : null,
      vehicleHeight: typeof vehicle.baseHeight === "number" ? vehicle.baseHeight : null,
      label: typeof vehicle.label === "string" && vehicle.label.trim() !== "" ? vehicle.label : null,
      kind: "PROFILE",
      status: null,
    });
  }
  return [...out.values()];
}

export function matchingVehicles(
  choices: ExistingVehicleChoice[],
  currentPlate: string,
): ExistingVehicleChoice[] {
  const key = plateKey(currentPlate);
  if (key === "") return choices;
  return choices.filter((choice) => plateKey(choice.plate) === key);
}
