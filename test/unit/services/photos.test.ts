import {expect, jest, test} from "@jest/globals";
import * as ImagePicker from "expo-image-picker";
import * as permissions from "../../../src/services/permissions";
import {PHOTO_PERMISSION_ERROR, pickPhotos, takePhoto} from "../../../src/services/photos";

jest.mock("firebase/app", () => ({getApps: () => []}));

jest.mock("firebase/storage", () => ({getDownloadURL: jest.fn(), getStorage: jest.fn(), ref: jest.fn(), uploadBytes: jest.fn()}));

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../../../src/services/permissions", () => ({
  requestCameraPermission: jest.fn(),
  requestMediaLibraryPermission: jest.fn(),
}));

const requestCameraPermission = permissions.requestCameraPermission as jest.MockedFunction<typeof permissions.requestCameraPermission>;
const requestMediaLibraryPermission = permissions.requestMediaLibraryPermission as jest.MockedFunction<typeof permissions.requestMediaLibraryPermission>;
const launchCameraAsync = ImagePicker.launchCameraAsync as jest.MockedFunction<typeof ImagePicker.launchCameraAsync>;
const launchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ImagePicker.launchImageLibraryAsync>;

test("takePhoto throws the shared permission error when camera access is off", async () => {
  launchCameraAsync.mockClear();
  requestCameraPermission.mockResolvedValue({granted: false, canAskAgain: true});
  await expect(takePhoto()).rejects.toThrow(PHOTO_PERMISSION_ERROR);
  expect(launchCameraAsync).not.toHaveBeenCalled();
});

test("takePhoto returns the captured photo", async () => {
  requestCameraPermission.mockResolvedValue({granted: true, canAskAgain: true});
  launchCameraAsync.mockResolvedValue({canceled: false, assets: [{uri: "file:///camera.jpg"}]} as never);
  await expect(takePhoto()).resolves.toEqual(["file:///camera.jpg"]);
});

test("takePhoto returns nothing when the camera is dismissed", async () => {
  requestCameraPermission.mockResolvedValue({granted: true, canAskAgain: true});
  launchCameraAsync.mockResolvedValue({canceled: true, assets: null} as never);
  await expect(takePhoto()).resolves.toEqual([]);
});

test("pickPhotos throws the shared permission error when the library is off", async () => {
  requestMediaLibraryPermission.mockResolvedValue({granted: false, canAskAgain: false});
  await expect(pickPhotos(5, 0)).rejects.toThrow(PHOTO_PERMISSION_ERROR);
  expect(launchImageLibraryAsync).not.toHaveBeenCalled();
});

test("pickPhotos returns the picked photos", async () => {
  requestMediaLibraryPermission.mockResolvedValue({granted: true, canAskAgain: true});
  launchImageLibraryAsync.mockResolvedValue({canceled: false, assets: [{uri: "file:///a.jpg"}, {uri: "file:///b.jpg"}]} as never);
  await expect(pickPhotos(5, 0)).resolves.toEqual(["file:///a.jpg", "file:///b.jpg"]);
});

test("pickPhotos skips the picker when the limit is reached", async () => {
  requestMediaLibraryPermission.mockClear();
  const picked = await pickPhotos(5, 5);
  expect(picked).toEqual([]);
  expect(requestMediaLibraryPermission).not.toHaveBeenCalled();
});
