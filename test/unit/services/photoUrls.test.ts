import {expect, jest, test} from "@jest/globals";

jest.mock("firebase/app", () => ({getApps: () => [{}]}));

jest.mock("firebase/storage", () => ({
  getDownloadURL: jest.fn(async (storageRef: {path: string}) => `https://cdn.test/${storageRef.path}`),
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((_storage: unknown, path: string) => ({path})),
}));

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../../../src/services/permissions", () => ({
  requestCameraPermission: jest.fn(),
  requestMediaLibraryPermission: jest.fn(),
}));

import {getDownloadURL} from "firebase/storage";
import {resolvePhotoUrl} from "../../../src/services/photos";

test("concurrent resolvePhotoUrl calls share a single download-url request", async () => {
  const download = getDownloadURL as jest.MockedFunction<typeof getDownloadURL>;
  download.mockClear();
  const [first, second] = await Promise.all([
    resolvePhotoUrl("flags/u1/a.jpg"),
    resolvePhotoUrl("flags/u1/a.jpg"),
  ]);
  expect(first).toBe("https://cdn.test/flags/u1/a.jpg");
  expect(second).toBe(first);
  expect(download).toHaveBeenCalledTimes(1);
});

test("resolved download URLs stay cached across later calls", async () => {
  const download = getDownloadURL as jest.MockedFunction<typeof getDownloadURL>;
  download.mockClear();
  const first = await resolvePhotoUrl("flags/u1/b.jpg");
  expect(first).toBe("https://cdn.test/flags/u1/b.jpg");
  expect(download).toHaveBeenCalledTimes(1);
  const second = await resolvePhotoUrl("flags/u1/b.jpg");
  expect(second).toBe(first);
  expect(download).toHaveBeenCalledTimes(1);
});

test("http urls pass through without a storage lookup", async () => {
  const download = getDownloadURL as jest.MockedFunction<typeof getDownloadURL>;
  download.mockClear();
  await expect(resolvePhotoUrl("https://cdn.test/already.jpg")).resolves.toBe("https://cdn.test/already.jpg");
  expect(download).toHaveBeenCalledTimes(0);
});
