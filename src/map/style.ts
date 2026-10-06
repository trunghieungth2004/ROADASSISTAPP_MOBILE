import {config} from "../config";
import type {StyleSpecification} from "@maplibre/maplibre-gl-style-spec";
import base from "./streets-v4.json";
import darkBase from "./streets-dark-v4.json";

export const mapDefaults = {
  center: [106.6602, 10.7626] as [number, number],
  zoom: 13,
};

const KEY_TOKEN = "__MAPTILER_KEY__";

export function buildMapStyle(key: string, scheme: "light" | "dark" = "light"): StyleSpecification {
  return JSON.parse(
    JSON.stringify(scheme === "dark" ? darkBase : base).split(KEY_TOKEN).join(key),
  ) as StyleSpecification;
}

const styleCache = new Map<string, {key: string; style: StyleSpecification}>();

export function bundledMapStyle(scheme: "light" | "dark" = "light"): StyleSpecification | undefined {
  if (!config.maptilerKey) return undefined;
  const cached = styleCache.get(scheme);
  if (cached && cached.key === config.maptilerKey) return cached.style;
  const style = buildMapStyle(config.maptilerKey, scheme);
  styleCache.set(scheme, {key: config.maptilerKey, style});
  return style;
}
