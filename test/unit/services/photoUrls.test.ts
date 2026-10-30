import {beforeEach, expect, jest, test} from "@jest/globals";

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
import {resolvePhotoUrl, thumbPathFor} from "../../../src/services/photos";

const download = getDownloadURL as jest.MockedFunction<typeof getDownloadURL>;
const pathOf = (storageRef: unknown): string => (storageRef as {path: string}).path;

beforeEach(() => {
  download.mockReset();
  download.mockImplementation(async (storageRef) => `https://cdn.test/${pathOf(storageRef)}`);
});

test("thumbnail paths keep the file extension", () => {
  expect(thumbPathFor("flags/u1/a.jpg")).toBe("flags/u1/a-thumb.jpg");
  expect(thumbPathFor("flags/u1/no-extension")).toBe("flags/u1/no-extension-thumb");
});

test("thumbnail resolution prefers the thumbnail image", async () => {
  await expect(resolvePhotoUrl("flags/u1/full.jpg", {thumb: true})).resolves.toBe("https://cdn.test/flags/u1/full-thumb.jpg");
});

test("thumbnail resolution falls back to the full image", async () => {
  download.mockImplementation(async (storageRef) => {
    if (pathOf(storageRef).endsWith("-thumb.jpg")) throw new Error("missing");
    return `https://cdn.test/${pathOf(storageRef)}`;
  });
  await expect(resolvePhotoUrl("flags/u1/missing.jpg", {thumb: true})).resolves.toBe("https://cdn.test/flags/u1/missing.jpg");
});

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
