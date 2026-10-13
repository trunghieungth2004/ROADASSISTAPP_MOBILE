import {expect, jest, test, beforeEach, afterEach} from "@jest/globals";
import {Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  downloadAndInstall,
  fetchLatestRelease,
  installedVersion,
  isAutoCheckEnabled,
  isNewer,
  parseVersionTag,
  setAutoCheckEnabled,
  shouldOfferUpdate,
  skipRelease,
} from "../../../src/services/appUpdate";

jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  Paths: {cache: {uri: "file:///cache/"}},
  File: jest.fn((dir: {uri: string} | string, name?: string) => ({
    uri: `${typeof dir === "string" ? dir : dir.uri}${name ?? ""}`,
  })),
  Directory: jest.fn(),
  createDownloadResumable: jest.fn(
    (url: string, target: string, options: unknown, onProgress?: (p: {totalBytesWritten: number; totalBytesExpectedToWrite: number}) => void) => ({
      downloadAsync: jest.fn(async () => {
        onProgress?.({totalBytesWritten: 50, totalBytesExpectedToWrite: 100});
        return {uri: target};
      }),
    }),
  ),
  getContentUriAsync: jest.fn(async (uri: string) => `content://${uri}`),
}));

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "0.1.0",
  nativeBuildVersion: "1",
}));

const realFetch = globalThis.fetch;
const realOS = Platform.OS;

function setOS(os: string): void {
  Object.defineProperty(Platform, "OS", {value: os, configurable: true});
}

function githubRelease(tag: string, apk = true) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: tag,
      body: "Notes here",
      assets: apk
        ? [{name: `roadassist-${tag}.apk`, browser_download_url: "https://example.com/app.apk"}]
        : [{name: "notes.txt", browser_download_url: "https://example.com/notes.txt"}],
    }),
  } as Response;
}

beforeEach(async () => {
  setOS("android");
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  setOS(realOS);
});

test("version tags parse and compare", () => {
  expect(parseVersionTag("v0.2.0")).toEqual([0, 2, 0]);
  expect(parseVersionTag("1.10")).toEqual([1, 10]);
  expect(parseVersionTag("")).toBeNull();
  expect(parseVersionTag("abc")).toBeNull();
  expect(isNewer("v0.2.0", "0.1.0")).toBe(true);
  expect(isNewer("v0.1.0", "0.1.0")).toBe(false);
  expect(isNewer("v0.1.0", "0.2.0")).toBe(false);
  expect(isNewer("v0.10.0", "0.9.0")).toBe(true);
  expect(isNewer("v1.0", "0.9.9")).toBe(true);
  expect(isNewer("nope", "0.1.0")).toBe(false);
});

test("latest release needs a tag and an apk asset", async () => {
  globalThis.fetch = (jest.fn(async () => githubRelease("v0.2.0")) as unknown) as typeof fetch;
  await expect(fetchLatestRelease()).resolves.toMatchObject({tag: "v0.2.0", apkUrl: "https://example.com/app.apk"});
  globalThis.fetch = (jest.fn(async () => githubRelease("v0.2.0", false)) as unknown) as typeof fetch;
  await expect(fetchLatestRelease()).resolves.toBeNull();
  globalThis.fetch = (jest.fn(async () => ({ok: false, status: 404, json: async () => ({})})) as unknown) as typeof fetch;
  await expect(fetchLatestRelease()).resolves.toBeNull();
});

test("offer respects version, skip, and auto toggle", async () => {
  expect(installedVersion()).toBe("0.1.0");
  globalThis.fetch = (jest.fn(async () => githubRelease("v0.2.0")) as unknown) as typeof fetch;
  await expect(shouldOfferUpdate()).resolves.toMatchObject({tag: "v0.2.0"});
  await skipRelease("v0.2.0");
  await expect(shouldOfferUpdate()).resolves.toBeNull();
  await AsyncStorage.removeItem("roadassist.update.skipped");
  await setAutoCheckEnabled(false);
  expect(await isAutoCheckEnabled()).toBe(false);
  await expect(shouldOfferUpdate()).resolves.toBeNull();
  await setAutoCheckEnabled(true);
  globalThis.fetch = (jest.fn(async () => githubRelease("v0.1.0")) as unknown) as typeof fetch;
  await expect(shouldOfferUpdate()).resolves.toBeNull();
});

test("download hands a content uri to the installer with progress", async () => {
  const seen: number[] = [];
  await downloadAndInstall("https://example.com/app.apk", (f) => {
    seen.push(f);
  });
  expect(seen).toEqual([0.5]);
  const FileSystem = jest.requireMock("expo-file-system") as {
    createDownloadResumable: jest.Mock;
  };
  const IntentLauncher = jest.requireMock("expo-intent-launcher") as {
    startActivityAsync: jest.Mock;
  };
  expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
    "https://example.com/app.apk",
    "file:///cache/roadassist-update.apk",
    {},
    expect.any(Function),
  );
  expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith("android.intent.action.VIEW", {
    data: "content://file:///cache/roadassist-update.apk",
    type: "application/vnd.android.package-archive",
    flags: 1,
  });
});
