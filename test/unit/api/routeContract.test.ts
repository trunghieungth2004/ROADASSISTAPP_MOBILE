import {expect, jest, test} from "@jest/globals";
import {ApiError} from "../../../src/api/client";
import {findRoute, renameSavedRoute} from "../../../src/api/routes";

const realFetch = globalThis.fetch;

function envelopeResponse(text: string, ok = true, status = 200): Response {
  return {ok, status, text: async () => text} as Response;
}

function okEnvelope(data: unknown): Response {
  return envelopeResponse(JSON.stringify({statusCode: 200, status: "SUCCESS", data}));
}

function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

const route = {source: "test", geometry: {type: "LineString", coordinates: [[106.6, 10.7], [106.7, 10.8]]}, distanceMeters: 100, durationSeconds: 60};

test("findRoute passes through routes with usable geometry", async () => {
  globalThis.fetch = (jest.fn(async () => okEnvelope({cached: false, routes: [route]})) as unknown) as typeof fetch;
  try {
    await expect(findRoute({originLat: 10.7, originLng: 106.6, destLat: 10.8, destLng: 106.7}, "tok")).resolves.toMatchObject({cached: false});
  } finally {
    restoreFetch();
  }
});

test("findRoute rejects routes without usable geometry", async () => {
  const bad = {source: "test", distanceMeters: 100};
  globalThis.fetch = (jest.fn(async () => okEnvelope({cached: false, routes: [bad]})) as unknown) as typeof fetch;
  try {
    await expect(findRoute({originLat: 10.7, originLng: 106.6, destLat: 10.8, destLng: 106.7}, "tok")).rejects.toThrow("Route has no usable geometry");
  } finally {
    restoreFetch();
  }
});

test("non-JSON bodies become ApiError with the http status", async () => {
  globalThis.fetch = (jest.fn(async () => envelopeResponse("<html>bad gateway</html>", false, 502)) as unknown) as typeof fetch;
  try {
    const err = await renameSavedRoute("r1", "n", "tok").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(502);
    expect((err as ApiError).message).toBe("Request failed (502)");
  } finally {
    restoreFetch();
  }
});

test("renameSavedRoute hits the saved route endpoint", async () => {
  let seenUrl = "";
  let seenBody = "";
  globalThis.fetch = (jest.fn(async (url: string, init?: RequestInit) => {
    seenUrl = url;
    seenBody = String(init?.body ?? "");
    return okEnvelope({renamed: 1});
  }) as unknown) as typeof fetch;
  try {
    await expect(renameSavedRoute("r1", "Home", "tok")).resolves.toEqual({renamed: 1});
    expect(seenUrl.endsWith("/routes/saved")).toBe(true);
    expect(seenBody).toContain("Home");
  } finally {
    restoreFetch();
  }
});

test("findRoute drops out-of-set vehicleType instead of sending a 400", async () => {
  let seen: Record<string, unknown> = {};
  globalThis.fetch = (jest.fn(async (_url: string, init?: RequestInit) => {
    seen = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return okEnvelope({cached: false, routes: [route]});
  }) as unknown) as typeof fetch;
  try {
    await findRoute({originLat: 10.7, originLng: 106.6, destLat: 10.8, destLng: 106.7, vehicleType: "HORSE", width: Number.NaN}, "tok");
  } finally {
    restoreFetch();
  }
  expect(seen).not.toHaveProperty("vehicleType");
  expect(seen).not.toHaveProperty("width");
});

test("findRoute keeps valid vehicleType and width", async () => {
  let seen: Record<string, unknown> = {};
  globalThis.fetch = (jest.fn(async (_url: string, init?: RequestInit) => {
    seen = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return okEnvelope({cached: false, routes: [route]});
  }) as unknown) as typeof fetch;
  try {
    await findRoute({originLat: 10.7, originLng: 106.6, destLat: 10.8, destLng: 106.7, vehicleType: "SCOOTER", width: 0.7}, "tok");
  } finally {
    restoreFetch();
  }
  expect(seen).toMatchObject({vehicleType: "SCOOTER", width: 0.7});
});
