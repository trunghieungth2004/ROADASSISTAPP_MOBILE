const PLATE_SHAPE = /^\d{2}[A-Z0-9]{1,3}\d{4,6}$/;

export function normalizeTowPlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidTowPlate(raw: string): boolean {
  return PLATE_SHAPE.test(normalizeTowPlate(raw));
}

export function parseTowWidth(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0.3 || value > 3) return null;
  return Math.round(value * 100) / 100;
}

export type TowDraftError = "plate" | "type" | "width" | null;

export const TOW_TYPES = ["CAR", "VAN", "TRUCK"] as const;

export type TowVehicleKind = (typeof TOW_TYPES)[number];

export function isTowVehicleKind(value: string): value is TowVehicleKind {
  return (TOW_TYPES as readonly string[]).includes(value);
}

export function validateTowDraft(draft: {plate: string; vehicleType: string; width: string}): TowDraftError {
  if (!isValidTowPlate(draft.plate)) return "plate";
  if (!isTowVehicleKind(draft.vehicleType)) return "type";
  if (parseTowWidth(draft.width) === null) return "width";
  return null;
}
