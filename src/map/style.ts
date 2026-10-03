import {config} from "../config";
import type {StyleSpecification} from "@maplibre/maplibre-gl-style-spec";
import base from "./streets-v4.json";

export const mapDefaults = {
  center: [106.6602, 10.7626] as [number, number],
  zoom: 13,
};

const KEY_TOKEN = "__MAPTILER_KEY__";

export function buildMapStyle(key: string): StyleSpecification {
  return JSON.parse(
    JSON.stringify(base).split(KEY_TOKEN).join(key),
  ) as StyleSpecification;
}

export function bundledMapStyle(): StyleSpecification | undefined {
  if (!config.maptilerKey) return undefined;
  return buildMapStyle(config.maptilerKey);
}
