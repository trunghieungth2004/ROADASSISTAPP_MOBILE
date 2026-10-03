import {expect, jest, test} from "@jest/globals";
import {act, create} from "react-test-renderer";
import {usePlaceSearch} from "../../../src/components/place-search/usePlaceSearch";
import {capturePosition, useLocationBeat} from "../../../src/services/locationBeats";

const realFetch = globalThis.fetch;

function HookProbe({hook, onValue}: {hook: () => unknown; onValue: (v: unknown) => void}) {
  onValue(hook());
  return null;
}

test("usePlaceSearch clears its debounce on unmount", async () => {
  jest.useFakeTimers();
  const seen: string[] = [];
  globalThis.fetch = (jest.fn(async (url: string) => {
    seen.push(String(url));
    return {ok: true, status: 200, json: async () => ({features: []})};
  }) as unknown) as typeof fetch;
  let search: ReturnType<typeof usePlaceSearch> | undefined;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <HookProbe hook={() => usePlaceSearch({lang: "en"})} onValue={(v) => { search = v as ReturnType<typeof usePlaceSearch>; }} />,
      );
    });
    act(() => {
      search?.handleInput("demo");
    });
    act(() => {
      renderer?.unmount();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(seen).toEqual([]);
  } finally {
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  }
});

test("useLocationBeat fires immediately, on interval, and stops", async () => {
  jest.useFakeTimers();
  let calls = 0;
  const beat = jest.fn(async () => { calls += 1; });
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <HookProbe hook={() => useLocationBeat(true, 300000, beat)} onValue={() => undefined} />,
      );
    });
    await act(async () => undefined);
    expect(calls).toBe(1);
    act(() => {
      jest.advanceTimersByTime(300000);
    });
    await act(async () => undefined);
    expect(calls).toBe(2);
    await act(async () => {
      renderer?.update(
        <HookProbe hook={() => useLocationBeat(false, 300000, beat)} onValue={() => undefined} />,
      );
    });
    act(() => {
      jest.advanceTimersByTime(600000);
    });
    await act(async () => undefined);
    expect(calls).toBe(2);
  } finally {
    renderer?.unmount();
    jest.useRealTimers();
  }
  expect(beat).toHaveBeenCalled();
});

test("capturePosition returns null without permission", async () => {
  const location = jest.requireMock("expo-location") as {
    getForegroundPermissionsAsync: jest.MockedFunction<() => Promise<{status: string}>>;
  };
  location.getForegroundPermissionsAsync.mockResolvedValueOnce({status: "denied"});
  await expect(capturePosition()).resolves.toBeNull();
});
