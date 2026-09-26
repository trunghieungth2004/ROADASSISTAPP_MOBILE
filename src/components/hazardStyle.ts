import type {ComponentProps} from "react";
import {MaterialIcons} from "@expo/vector-icons";

type HazardKind = {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  color: string;
};

const KINDS: Record<string, HazardKind> = {
  ACCIDENT: {icon: "car-crash", color: "#dc2626"},
  FLOOD: {icon: "water-drop", color: "#0284c7"},
  OBSTRUCTION: {icon: "construction", color: "#d97706"},
};

const FALLBACK: HazardKind = {icon: "warning", color: "#d97706"};

export function hazardKind(type: string | undefined): HazardKind {
  if (!type) return FALLBACK;
  return KINDS[type.toUpperCase()] ?? FALLBACK;
}
