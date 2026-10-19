import {Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import {File, Paths} from "expo-file-system";
import {createDownloadResumable, getContentUriAsync} from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

export type AppRelease = {
  tag: string;
  notes: string;
  apkUrl: string;
};

export const REPO_SLUG = "trunghieungth2004/ROADASSISTAPP_MOBILE";
export const GITHUB_URL = `https://github.com/${REPO_SLUG}`;
const RELEASES_URL = `https://api.github.com/repos/${REPO_SLUG}/releases/latest`;
const SKIPPED_KEY = "roadassist.update.skipped";
const AUTO_KEY = "roadassist.update.auto";

export function parseVersionTag(tag: string): number[] | null {
  const base = tag.trim().replace(/^v/i, "").split("-")[0] ?? "";
  if (base === "") return null;
  const parts = base.split(".");
  const nums: number[] = [];
  for (const part of parts) {
    if (part === "" || !/^\d+$/.test(part)) return null;
    nums.push(Number(part));
  }
  return nums.length > 0 ? nums : null;
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersionTag(latest);
  const b = parseVersionTag(current);
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function fetchLatestRelease(): Promise<AppRelease | null> {
  if (Platform.OS !== "android") return null;
  let body: {
    tag_name?: unknown;
    body?: unknown;
    assets?: unknown;
  };
  try {
    const res = await fetch(RELEASES_URL, {
      headers: {Accept: "application/vnd.github+json"},
    });
    if (!res.ok) return null;
    body = (await res.json()) as typeof body;
  } catch {
    return null;
  }
  const tag = typeof body.tag_name === "string" ? body.tag_name : "";
  const assets = Array.isArray(body.assets) ? body.assets : [];
  const apk = assets.find(
    (a): a is {browser_download_url: string} =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as {name?: unknown}).name === "string" &&
      ((a as {name: string}).name.startsWith("roadassist-") &&
        (a as {name: string}).name.endsWith(".apk")) &&
      typeof (a as {browser_download_url?: unknown}).browser_download_url ===
        "string",
  );
  if (tag === "" || !apk) return null;
  return {
    tag,
    notes: typeof body.body === "string" ? body.body : "",
    apkUrl: apk.browser_download_url,
  };
}

export function installedVersion(): string | null {
  if (Platform.OS !== "android") return null;
  return Application.nativeApplicationVersion ?? null;
}

export async function isAutoCheckEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AUTO_KEY)) !== "0";
  } catch {
    return true;
  }
}

export async function setAutoCheckEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_KEY, on ? "1" : "0").catch(() => undefined);
}

export async function shouldOfferUpdate(): Promise<AppRelease | null> {
  const current = installedVersion();
  if (!current) return null;
  try {
    if (!(await isAutoCheckEnabled())) return null;
    const release = await fetchLatestRelease();
    if (!release || !isNewer(release.tag, current)) return null;
    const skipped = await AsyncStorage.getItem(SKIPPED_KEY);
    if (skipped === release.tag) return null;
    return release;
  } catch {
    return null;
  }
}

export async function skipRelease(tag: string): Promise<void> {
  await AsyncStorage.setItem(SKIPPED_KEY, tag).catch(() => undefined);
}

export async function downloadAndInstall(
  apkUrl: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const cleanUrl = apkUrl.split("?")[0] ?? apkUrl;
  if (!cleanUrl.toLowerCase().endsWith(".apk")) throw new Error("Update file is not an APK");
  const target = new File(Paths.cache, "roadassist-update.apk").uri;
  const task = createDownloadResumable(apkUrl, target, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const result = await task.downloadAsync();
  const file = new File(result?.uri ?? target);
  if (!file.exists || file.size <= 0) throw new Error("Downloaded update is empty");
  const contentUri = await getContentUriAsync(file.uri);
  try {
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      type: "application/vnd.android.package-archive",
      flags: 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("ActivityNotFound") || msg.includes("No Activity")) throw new Error("No installer found to open the update");
    throw new Error("Could not open the update installer");
  }
}
