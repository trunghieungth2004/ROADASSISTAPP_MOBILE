import {beforeEach, expect, jest, test} from "@jest/globals";

jest.mock("firebase/app", () => ({getApps: () => [{}]}));

jest.mock("firebase/storage", () => ({
  getDownloadURL: jest.fn(),
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((_storage: unknown, path: string) => ({path})),
  uploadBytes: jest.fn(async (_ref: unknown, data: unknown) => {
    if (!(data instanceof Blob)) {
      throw new Error(
        "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported",
      );
    }
    return {};
  }),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({uri: "file:///thumb.jpg"})),
  SaveFormat: {JPEG: "jpeg"},
}));

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    size = 1024;
    constructor(uri: string) {
      this.uri = uri;
    }
  },
}));

jest.mock("../../../src/services/permissions", () => ({
  requestCameraPermission: jest.fn(),
  requestMediaLibraryPermission: jest.fn(),
}));

import {uploadBytes} from "firebase/storage";
import {manipulateAsync} from "expo-image-manipulator";
import {uploadPhotoPaths} from "../../../src/services/photos";

function photoResponse(size = 1024): Response {
  return {
    blob: async () => new Blob([new Uint8Array(size)], {type: "image/jpeg"}),
  } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(globalThis, "fetch").mockResolvedValue(photoResponse());
});

test("photo uploads pass Blobs to Storage and write the thumbnail", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(123);
  try {
    await expect(uploadPhotoPaths("chat/t1", ["file:///full.jpg"])).resolves.toEqual([
      "chat/t1/123-0.jpg",
    ]);
    const calls = jest.mocked(uploadBytes).mock.calls;
    expect(manipulateAsync).toHaveBeenCalled();
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toBeInstanceOf(Blob);
    expect(calls[1][1]).toBeInstanceOf(Blob);
    const paths = calls.map((call) => (call[0] as unknown as {path: string}).path);
    expect(paths).toEqual([
      "chat/t1/123-0.jpg",
      "chat/t1/123-0-thumb.jpg",
    ]);
  } finally {
    now.mockRestore();
  }
});

test("photo uploads reject an oversized blob before calling Storage", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(photoResponse(900 * 1024));
  await expect(
    uploadPhotoPaths("dispatch/pending-1", ["file:///large.jpg"]),
  ).rejects.toThrow("photo-too-large");
  expect(uploadBytes).not.toHaveBeenCalled();
});

test("photo uploads reject when fetch cannot read the photo", async () => {
  jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch failed"));
  await expect(
    uploadPhotoPaths("dispatch/pending-1", ["file:///missing.jpg"]),
  ).rejects.toThrow("fetch failed");
  expect(uploadBytes).not.toHaveBeenCalled();
});
