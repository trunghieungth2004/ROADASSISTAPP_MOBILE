import {expect, test} from "@jest/globals";
import {buildMapStyle, bundledMapStyle} from "../../../src/map/style";

function fontNames(style: unknown): string[] {
  const layers = (style as {layers: {layout?: {["text-font"]?: unknown}}[]}).layers;
  const names = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && (entry.startsWith("Roboto") || entry.startsWith("Noto Sans"))) {
          names.add(entry);
        } else {
          walk(entry);
        }
      }
    }
  };
  for (const layer of layers) walk(layer.layout?.["text-font"]);
  return [...names].sort();
}

test("vendored style uses only the regular and bold pairs", () => {
  const names = fontNames(buildMapStyle("test-key"));
  expect(names).toEqual(["Noto Sans Bold", "Noto Sans Regular", "Roboto Bold", "Roboto Regular"]);
});

test("buildMapStyle injects the runtime key everywhere", () => {
  const raw = JSON.stringify(buildMapStyle("test-key-123"));
  expect(raw).toContain("test-key-123");
  expect(raw).not.toContain("__MAPTILER_KEY__");
  expect(raw).not.toContain("GglAczWT");
});

function backgroundOf(style: unknown): unknown {
  const layers = (style as {layers: {id: string; paint?: unknown}[]}).layers;
  return layers.find((l) => l.id === "Background")?.paint;
}

test("dark scheme builds a different basemap on the same tileset", () => {
  const light = buildMapStyle("test-key-123", "light");
  const dark = buildMapStyle("test-key-123", "dark");
  expect(JSON.stringify(dark)).toContain("test-key-123");
  expect(JSON.stringify(dark)).not.toContain("__MAPTILER_KEY__");
  expect(backgroundOf(dark)).not.toEqual(backgroundOf(light));
  const ids = (dark as {layers: {id: string}[]}).layers.map((l) => l.id);
  expect(ids).toContain("Ferry labels");
  expect(dark.sources).toHaveProperty("maptiler_planet_v4");
});

test("bundledMapStyle defaults to light and switches on scheme", () => {
  expect(backgroundOf(bundledMapStyle())).toEqual(backgroundOf(buildMapStyle("x", "light")));
  expect(backgroundOf(bundledMapStyle("dark"))).not.toEqual(backgroundOf(bundledMapStyle("light")));
});

