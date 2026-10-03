import {expect, jest, test} from "@jest/globals";
import {formatPoint, reverseLabel, searchMapPlaces} from "../../../src/api/places";
import {config} from "../../../src/config";

const realFetch = globalThis.fetch;

function jsonResponse(body: unknown, ok = true): Response {
  return {ok, json: async () => body} as Response;
}

function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

test("reverseLabel returns the first feature name", async () => {
  globalThis.fetch = (jest.fn(async () => jsonResponse({features: [{place_name: "434 Vinh Vien"}]})) as unknown) as typeof fetch;
  try {
    await expect(reverseLabel(10.75, 106.65, "en")).resolves.toBe("434 Vinh Vien");
  } finally {
    restoreFetch();
  }
});

test("reverseLabel falls back to coordinates on bad status", async () => {
  globalThis.fetch = (jest.fn(async () => jsonResponse({}, false)) as unknown) as typeof fetch;
  try {
    await expect(reverseLabel(10.75, 106.65, "en")).resolves.toBe(formatPoint(10.75, 106.65));
  } finally {
    restoreFetch();
  }
});

test("reverseLabel falls back to coordinates on network failure", async () => {
  globalThis.fetch = (jest.fn(async () => {
    throw new Error("down");
  }) as unknown) as typeof fetch;
  try {
    await expect(reverseLabel(10.75, 106.65, "vi")).resolves.toBe(formatPoint(10.75, 106.65));
  } finally {
    restoreFetch();
  }
});

test("reverseLabel falls back to coordinates without a key", async () => {
  const prev = config.maptilerKey;
  jest.replaceProperty(config, "maptilerKey", "");
  try {
    await expect(reverseLabel(10.75, 106.65, "en")).resolves.toBe(formatPoint(10.75, 106.65));
  } finally {
    jest.replaceProperty(config, "maptilerKey", prev);
  }
});

test("searchMapPlaces returns [] for short queries without fetching", async () => {
  const spy = jest.fn(async () => jsonResponse({features: []}));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  try {
    await expect(searchMapPlaces("ab", "en")).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    restoreFetch();
  }
});

test("searchMapPlaces maps features to places", async () => {
  globalThis.fetch = (jest.fn(async () => jsonResponse({features: [{place_name: "Park A", center: [106.66, 10.76], properties: {}}]})) as unknown) as typeof fetch;
  try {
    const hits = await searchMapPlaces("park", "en");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.label).toBe("Park A");
    expect(hits[0]?.lat).toBeCloseTo(10.76);
  } finally {
    restoreFetch();
  }
});

test("searchMapPlaces returns [] when the fetch fails", async () => {
  globalThis.fetch = (jest.fn(async () => {
    throw new Error("down");
  }) as unknown) as typeof fetch;
  try {
    await expect(searchMapPlaces("park", "en")).resolves.toEqual([]);
  } finally {
    restoreFetch();
  }
});
