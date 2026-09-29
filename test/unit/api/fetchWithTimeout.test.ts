import {afterEach, expect, jest, test} from "@jest/globals";
import {fetchWithTimeout} from "../../../src/api/client";

const realFetch = globalThis.fetch;

function hangingFetch(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise<Response>((_, reject) => {
    signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("resolves before the timeout", async () => {
  globalThis.fetch = (jest.fn(async () => new Response("ok")) as unknown) as typeof fetch;
  const res = await fetchWithTimeout("https://example.com/ping", {}, 2000);
  expect(res.ok).toBe(true);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

test("rejects when the request hangs past the timeout", async () => {
  let seen: AbortSignal | null | undefined;
  globalThis.fetch = (jest.fn((_url: string, init?: RequestInit) => {
    seen = init?.signal;
    return hangingFetch(seen ?? null);
  }) as unknown) as typeof fetch;
  await expect(fetchWithTimeout("https://example.com/hang", {}, 50)).rejects.toThrow();
  expect(seen?.aborted).toBe(true);
});

test("propagates an external abort", async () => {
  const ctrl = new AbortController();
  globalThis.fetch = (jest.fn((_url: string, init?: RequestInit) => hangingFetch(init?.signal ?? null)) as unknown) as typeof fetch;
  const pending = fetchWithTimeout("https://example.com/cancel", {signal: ctrl.signal}, 5000);
  ctrl.abort();
  await expect(pending).rejects.toThrow("aborted");
});
