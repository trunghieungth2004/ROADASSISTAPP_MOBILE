import {afterEach, expect, jest, test} from "@jest/globals";
import {api, clearInflight} from "../../../src/api/client";

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
  clearInflight();
});

test("concurrent identical posts share one fetch", async () => {
  const spy = jest.fn(async () => envelope({n: 1}));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  const [a, b] = await Promise.all([
    api.post<{n: number}>("/probe/same", {q: "x"}, "tok"),
    api.post<{n: number}>("/probe/same", {q: "x"}, "tok"),
  ]);
  expect(a).toEqual({n: 1});
  expect(b).toEqual({n: 1});
  expect(spy).toHaveBeenCalledTimes(1);
});

test("sequential identical posts fetch twice", async () => {
  const spy = jest.fn(async () => envelope({n: 1}));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  await api.post("/probe/seq", {}, "tok");
  await api.post("/probe/seq", {}, "tok");
  expect(spy).toHaveBeenCalledTimes(2);
});

test("different bodies are not deduped", async () => {
  const spy = jest.fn(async () => envelope({}));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  await Promise.all([
    api.post("/probe/body", {q: "one"}, "tok"),
    api.post("/probe/body", {q: "two"}, "tok"),
  ]);
  expect(spy).toHaveBeenCalledTimes(2);
});

test("different tokens are not deduped", async () => {
  const spy = jest.fn(async () => envelope({}));
  globalThis.fetch = (spy as unknown) as typeof fetch;
  await Promise.all([
    api.post("/probe/token", {}, "tok-a"),
    api.post("/probe/token", {}, "tok-b"),
  ]);
  expect(spy).toHaveBeenCalledTimes(2);
});
