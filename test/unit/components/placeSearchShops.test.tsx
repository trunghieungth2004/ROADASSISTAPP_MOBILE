import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {usePlaceSearch} from "../../../src/components/place-search/usePlaceSearch";
import type {Place} from "../../../src/components/place-search/PlaceSearch.types";

const realFetch = globalThis.fetch;

function HookProbe({hook, onValue}: {hook: () => unknown; onValue: (v: unknown) => void}) {
  onValue(hook());
  return null;
}

function mapFeature(text: string, lng: number, lat: number, categories: string[]) {
  return {
    text,
    place_name: text,
    center: [lng, lat],
    properties: {categories},
  };
}

test("shops rank first with repair-gated map results", async () => {
  jest.useFakeTimers();
  const shops = jest.fn(async () => [
    {id: "s1", name: "Good Shop", lat: 10.71, lng: 106.61},
  ]);
  globalThis.fetch = (jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      features: [
        mapFeature("Repair Pro", 106.62, 10.72, ["motorcycle repair"]),
        mapFeature("Cafe Trung", 106.63, 10.73, ["cafe"]),
      ],
    }),
  })) as unknown) as typeof fetch;
  let search: ReturnType<typeof usePlaceSearch> | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <HookProbe
          hook={() => usePlaceSearch({
            lang: "en",
            shops,
            sources: ["shop", "map"],
            mapFilter: (p: Place) => (p.category ?? "").includes("repair"),
          })}
          onValue={(v) => {
            search = v as ReturnType<typeof usePlaceSearch>;
          }}
        />,
      );
    });
    act(() => {
      search?.handleInput("sua xe");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const options = search?.options ?? [];
    expect(options.map((p) => p.label)).toEqual(["Good Shop", "Repair Pro"]);
    expect(options[0]?.source).toBe("shop");
    expect(options[1]?.source).toBe("map");
  } finally {
    renderer?.unmount();
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  }
});

test("map results survive a shops failure", async () => {
  jest.useFakeTimers();
  const shops = jest.fn(async (): Promise<never[]> => {
    throw new Error("down");
  });
  globalThis.fetch = (jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      features: [mapFeature("Repair Pro", 106.62, 10.72, ["motorcycle repair"])],
    }),
  })) as unknown) as typeof fetch;
  let search: ReturnType<typeof usePlaceSearch> | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <HookProbe
          hook={() => usePlaceSearch({lang: "en", shops, sources: ["shop", "map"]})}
          onValue={(v) => {
            search = v as ReturnType<typeof usePlaceSearch>;
          }}
        />,
      );
    });
    act(() => {
      search?.handleInput("sua xe");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(search?.options.map((p) => p.label)).toEqual(["Repair Pro"]);
  } finally {
    renderer?.unmount();
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  }
});
