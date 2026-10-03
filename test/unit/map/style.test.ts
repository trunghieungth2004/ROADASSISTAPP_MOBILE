import {expect, test} from "@jest/globals";
import {buildMapStyle} from "../../../src/map/style";

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
