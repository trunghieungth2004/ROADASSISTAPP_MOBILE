import {expect, jest, test} from "@jest/globals";
import {getFix} from "../../../src/services/geo";

type LocationCoords = {coords: {latitude: number; longitude: number}};

type LocationMock = {
  hasServicesEnabledAsync: jest.MockedFunction<() => Promise<boolean>>;
  getLastKnownPositionAsync: jest.MockedFunction<() => Promise<LocationCoords | null>>;
  getCurrentPositionAsync: jest.MockedFunction<() => Promise<LocationCoords>>;
};

function location(): LocationMock {
  return jest.requireMock("expo-location") as unknown as LocationMock;
}

function reset(): void {
  const m = location();
  m.hasServicesEnabledAsync.mockReset();
  m.getLastKnownPositionAsync.mockReset();
  m.getCurrentPositionAsync.mockReset();
  m.hasServicesEnabledAsync.mockResolvedValue(true);
  m.getLastKnownPositionAsync.mockResolvedValue(null);
  m.getCurrentPositionAsync.mockResolvedValue({coords: {latitude: 10.7, longitude: 106.6}});
}

test("fresh cached fix wins without a live request", async () => {
  reset();
  location().getLastKnownPositionAsync.mockResolvedValueOnce({coords: {latitude: 10.1, longitude: 106.1}});
  await expect(getFix()).resolves.toEqual({lat: 10.1, lng: 106.1});
  expect(location().getCurrentPositionAsync).not.toHaveBeenCalled();
});

test("stale cache falls through to a live fix", async () => {
  reset();
  location().getLastKnownPositionAsync.mockResolvedValue(null);
  await expect(getFix()).resolves.toEqual({lat: 10.7, lng: 106.6});
  expect(location().getCurrentPositionAsync).toHaveBeenCalledTimes(1);
});

test("live timeout falls back to any cached fix", async () => {
  reset();
  location().getLastKnownPositionAsync
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({coords: {latitude: 10.2, longitude: 106.2}});
  location().getCurrentPositionAsync.mockImplementationOnce(
    () => new Promise(() => undefined) as Promise<{coords: {latitude: number; longitude: number}}>,
  );
  await expect(getFix({timeoutMs: 20})).resolves.toEqual({lat: 10.2, lng: 106.2});
});

test("disabled services fail fast without position calls", async () => {
  reset();
  location().hasServicesEnabledAsync.mockResolvedValueOnce(false);
  await expect(getFix()).rejects.toThrow("Location unavailable");
  expect(location().getLastKnownPositionAsync).not.toHaveBeenCalled();
  expect(location().getCurrentPositionAsync).not.toHaveBeenCalled();
});

test("total failure throws without a stale fallback when disabled", async () => {
  reset();
  location().getLastKnownPositionAsync.mockResolvedValue(null);
  location().getCurrentPositionAsync.mockRejectedValueOnce(new Error("down"));
  await expect(getFix({staleFallback: false, timeoutMs: 20})).rejects.toThrow("Location unavailable");
});
