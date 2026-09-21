import type {ComponentProps} from "react";
import {MaterialIcons} from "@expo/vector-icons";

export const FOLLOW_ZOOM = 17;
export const FOLLOW_PITCH = 50;
export const FOLLOW_MIN_MOVE_M = 3;
export const NAV_HOME: [number, number] = [106.6602, 10.7626];

export const courseBetween = (a: {lat: number; lng: number}, b: {lat: number; lng: number}): number => {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

export const distBetween = (a: {lat: number; lng: number}, b: {lat: number; lng: number}): number => {
  const x = ((b.lng - a.lng) * Math.PI) / 180 * Math.cos(((a.lat + b.lat) / 2 * Math.PI) / 180);
  const y = ((b.lat - a.lat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371000;
};

export function turnIcon(kind: string): ComponentProps<typeof MaterialIcons>["name"] {
  switch (kind) {
    case "start":
      return "navigation";
    case "destination":
      return "flag";
    case "continue":
      return "straight";
    case "slight-right":
      return "turn-slight-right";
    case "slight-left":
      return "turn-slight-left";
    case "turn-right":
    case "sharp-right":
    case "ramp":
      return "turn-right";
    case "turn-left":
    case "sharp-left":
      return "turn-left";
    case "uturn":
      return "u-turn-right";
    case "exit":
      return "exit-to-app";
    case "merge":
      return "merge-type";
    case "roundabout":
      return "roundabout-right";
    default:
      return "navigation";
  }
}

export function splitRoute(coords: [number, number][], segIndex: number, point: [number, number]): {traveled: [number, number][]; remaining: [number, number][]} {
  if (coords.length < 2) return {traveled: [], remaining: coords};
  const i = Math.max(0, Math.min(segIndex, coords.length - 2));
  return {traveled: [...coords.slice(0, i + 1), point], remaining: [point, ...coords.slice(i + 1)]};
}

export function formatDist(m: number, kmLabel: string, mLabel: string): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ${kmLabel}` : `${Math.round(m)} ${mLabel}`;
}

export function turnLabel(turns: Record<string, string>, fallback: string, kind: string): string {
  return turns[kind] ?? fallback;
}
