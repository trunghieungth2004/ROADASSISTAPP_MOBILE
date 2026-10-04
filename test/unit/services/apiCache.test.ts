import {afterEach, expect, jest, test} from "@jest/globals";
import {cacheClear, clearApiCache, withCache} from "../../../src/services/cache";
import {listSavedPlaces} from "../../../src/api/places";
import {listSavedRoutes} from "../../../src/api/routes";

const realFetch = globalThis.fetch;

function envelope(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({statusCode: 200, status: "SUCCESS", data}),
  } as Response;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  clearApiCache();
});

test("withCache serves the second call from memory", async () => {
  const loader = jest.fn(async () => ({n: 1}));
  await expect(withCache("probe:key", 30000, loader)).resolves.toEqual({n: 1});
  await expect(withCache("probe:key", 30000, loader)).resolves.toEqual({n: 1});
  expect(loader).toHaveBeenCalledTimes(1);
});

test("concurrent withCache misses share one load", async () => {
  let releases: Array<() => void> = [];
  const gate = new Promise<void>((resolve) => {
    releases.push(resolve);
  });
  const loader = jest.fn(async () => {
    await gate;
    return "v";
  });
  const pending = Promise.all([withCache("probe:gate", 30000, loader), withCache("probe:gate", 30000, loader)]);
  releases.forEach((r) => r());
  releases = [];
  await expect(pending).resolves.toEqual(["v", "v"]);
  expect(loader).toHaveBeenCalledTimes(1);
});

test("cacheClear with a prefix keeps other keys", async () => {
  const a = jest.fn(async () => 1);
  const b = jest.fn(async () => 2);
  await withCache("keep:k", 30000, a);
  await withCache("drop:k", 30000, b);
  cacheClear("drop:");
  await withCache("keep:k", 30000, a);
  await withCache("drop:k", 30000, b);
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(2);
});

test("listSavedPlaces hits the network once for repeat calls", async () => {
  const spy = jest.fn(async () => envelope([]));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  await listSavedPlaces("tok");
  await listSavedPlaces("tok");
  expect(spy).toHaveBeenCalledTimes(1);
});

test("listSavedRoutes hits the network once for repeat calls", async () => {
  const spy = jest.fn(async () => envelope([]));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  await listSavedRoutes("tok");
  await listSavedRoutes("tok");
  expect(spy).toHaveBeenCalledTimes(1);
});
