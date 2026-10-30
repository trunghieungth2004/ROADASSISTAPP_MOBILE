import {File} from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {getApps} from "firebase/app";
import {getDownloadURL, getStorage, ref, uploadBytes} from "firebase/storage";
import {useEffect, useState} from "react";
import {Image} from "react-native";
import {requestCameraPermission, requestMediaLibraryPermission} from "./permissions";

export const TICKET_PHOTO_MAX = 5;

export const PHOTO_PERMISSION_ERROR = "photo-permission";

export type PhotoSource = "camera" | "library";

const PHOTO_MAX_BYTES = 800 * 1024;
const PHOTO_MAX_DIMENSION = 1080;
const PHOTO_QUALITY = 0.65;
const THUMB_DIMENSION = 256;
const THUMB_QUALITY = 0.6;
const PHOTO_COMPRESS_CONCURRENCY = 2;

export function isPhotoPermissionError(err: unknown): boolean {
  return err instanceof Error && err.message === PHOTO_PERMISSION_ERROR;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, run: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({length: Math.min(Math.max(1, limit), items.length)}, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await run(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function pickPhotos(max: number, existing: number): Promise<string[]> {
  const room = Math.max(0, Math.min(max, TICKET_PHOTO_MAX) - existing);
  if (room <= 0) return [];
  const permission = await requestMediaLibraryPermission();
  if (!permission.granted) throw new Error(PHOTO_PERMISSION_ERROR);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: room,
    quality: 0.8,
  });
  if (result.canceled) return [];
  const uris = result.assets.map((a) => a.uri).filter((u) => typeof u === "string" && u !== "");
  return mapWithConcurrency(uris.slice(0, room), PHOTO_COMPRESS_CONCURRENCY, async (uri) => {
    try {
      return await compressPhoto(uri);
    } catch {
      return uri;
    }
  });
}

export async function takePhoto(): Promise<string[]> {
  const permission = await requestCameraPermission();
  if (!permission.granted) throw new Error(PHOTO_PERMISSION_ERROR);
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled) return [];
  const uri = result.assets[0]?.uri;
  if (typeof uri !== "string" || uri === "") return [];
  try {
    return [await compressPhoto(uri)];
  } catch {
    return [uri];
  }
}

async function fileSize(uri: string): Promise<number | null> {
  try {
    const file = new File(uri);
    if (typeof file.size === "number") return file.size;
  } catch {
  }
  try {
    return (await blobFrom(uri)).size;
  } catch {
    return null;
  }
}

async function blobFrom(uri: string): Promise<Blob> {
  try {
    const res = await fetch(uri);
    return await res.blob();
  } catch (err) {
    console.warn("[photos] blob read failed", uri, err);
    throw err;
  }
}

async function compressPhoto(uri: string): Promise<string> {
  try {
    let done = await ImageManipulator.manipulateAsync(
      uri,
      [{resize: {width: PHOTO_MAX_DIMENSION}}],
      {compress: PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG},
    );
    let size = await fileSize(done.uri);
    if (size !== null && size > PHOTO_MAX_BYTES) {
      done = await ImageManipulator.manipulateAsync(
        done.uri,
        [{resize: {width: 900}}],
        {compress: 0.5, format: ImageManipulator.SaveFormat.JPEG},
      );
      size = await fileSize(done.uri);
    }
    if (size !== null && size > PHOTO_MAX_BYTES) {
      done = await ImageManipulator.manipulateAsync(
        done.uri,
        [{resize: {width: 720}}],
        {compress: 0.4, format: ImageManipulator.SaveFormat.JPEG},
      );
    }
    return done.uri;
  } catch {
    return uri;
  }
}

async function compressThumb(uri: string): Promise<string | null> {
  try {
    const done = await ImageManipulator.manipulateAsync(
      uri,
      [{resize: {width: THUMB_DIMENSION}}],
      {compress: THUMB_QUALITY, format: ImageManipulator.SaveFormat.JPEG},
    );
    return done.uri;
  } catch {
    return null;
  }
}

export function thumbPathFor(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot > slash) return `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
  return `${path}-thumb`;
}

async function uploadToDirectory(directory: string, uris: string[]): Promise<string[]> {
  const apps = getApps();
  if (apps.length === 0 || uris.length === 0) return [];
  const storage = getStorage(apps[0]);
  const limited = uris.slice(0, TICKET_PHOTO_MAX);
  const stamp = Date.now();
  return Promise.all(
    limited.map(async (uri, i) => {
      const path = `${directory}/${stamp}-${i}.jpg`;
      const thumbPath = thumbPathFor(path);
      const fullBlob = await blobFrom(uri);
      if (fullBlob.size === 0) {
        throw new Error("photo-empty");
      }
      if (fullBlob.size > PHOTO_MAX_BYTES) {
        throw new Error(`photo-too-large-${fullBlob.size}`);
      }
      const thumbBlob = compressThumb(uri)
        .then((thumbUri) => thumbUri === null ? null : blobFrom(thumbUri))
        .catch(() => null);
      const fullUpload = uploadBytes(ref(storage, path), fullBlob, {contentType: "image/jpeg"});
      const thumbUpload = thumbBlob
        .then((thumb) => thumb === null ? undefined : uploadBytes(ref(storage, thumbPath), thumb, {contentType: "image/jpeg"}))
        .catch(() => undefined);
      await Promise.all([fullUpload, thumbUpload]);
      return path;
    }),
  );
}

export function uploadPhotoPaths(directory: string, uris: string[]): Promise<string[]> {
  return uploadToDirectory(directory, uris);
}

export function uploadFlagPhotos(uid: string, uris: string[]): Promise<string[]> {
  return uploadToDirectory(`flags/${uid}`, uris);
}

type UrlStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const URL_CACHE_KEY = "photo-url-cache/v1";
const URL_CACHE_MAX = 300;
const URL_CACHE_WRITE_MS = 750;

const urlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const thumbMisses = new Set<string>();
let cacheLoaded = false;
let cacheLoading: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function storageModule(): Promise<UrlStore | null> {
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    return mod.default;
  } catch {
    return null;
  }
}

function trimUrlCache(): void {
  while (urlCache.size > URL_CACHE_MAX) {
    const first = urlCache.keys().next().value;
    if (typeof first !== "string") break;
    urlCache.delete(first);
  }
}

function loadUrlCache(): Promise<void> {
  if (cacheLoaded) return Promise.resolve();
  if (!cacheLoading) {
    cacheLoading = (async () => {
      const store = await storageModule();
      if (store) {
        try {
          const raw = await store.getItem(URL_CACHE_KEY);
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              for (const [path, url] of Object.entries(parsed as Record<string, unknown>)) {
                if (typeof url === "string" && url !== "") urlCache.set(path, url);
              }
            }
          }
        } catch {
        }
      }
      trimUrlCache();
      cacheLoaded = true;
    })();
  }
  return cacheLoading;
}

async function writeUrlCache(): Promise<void> {
  const store = await storageModule();
  if (!store) return;
  try {
    await store.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(urlCache)));
  } catch {
  }
}

function persistUrlCache(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void writeUrlCache();
  }, URL_CACHE_WRITE_MS);
}

async function resolveStorageUrl(path: string): Promise<string> {
  if (/^https?:\/\//.test(path)) return path;
  const cached = urlCache.get(path);
  if (cached !== undefined) return cached;
  const apps = getApps();
  if (apps.length === 0) return "";
  await loadUrlCache();
  const persisted = urlCache.get(path);
  if (persisted !== undefined) return persisted;
  const pending = inFlight.get(path);
  if (pending) return pending;
  const request = (async () => {
    try {
      const url = await getDownloadURL(ref(getStorage(apps[0]), path));
      urlCache.set(path, url);
      trimUrlCache();
      persistUrlCache();
      return url;
    } catch {
      return "";
    } finally {
      inFlight.delete(path);
    }
  })();
  inFlight.set(path, request);
  return request;
}

export async function resolvePhotoUrl(path: string, options?: {thumb?: boolean}): Promise<string> {
  if (/^https?:\/\//.test(path)) return path;
  if (options?.thumb === true && !thumbMisses.has(path)) {
    const thumbUrl = await resolveStorageUrl(thumbPathFor(path));
    if (thumbUrl !== "") return thumbUrl;
    thumbMisses.add(path);
  }
  return resolveStorageUrl(path);
}

const PREFETCH_PHOTOS_MAX = 8;
const prefetchedBytes = new Set<string>();

export function prefetchFlagPhotos(groups: string[][]): void {
  const firstPerFlag: string[] = [];
  for (const group of groups) {
    const first = group.find((path) => typeof path === "string" && path !== "");
    if (first !== undefined) firstPerFlag.push(first);
  }
  const unique = [...new Set(firstPerFlag)].slice(0, PREFETCH_PHOTOS_MAX);
  if (unique.length === 0) return;
  const run = (): void => {
    for (const path of unique) {
      void resolvePhotoUrl(path, {thumb: true}).then((url) => {
        if (url === "" || prefetchedBytes.has(url)) return;
        prefetchedBytes.add(url);
        try {
          if (typeof Image.prefetch === "function") void Image.prefetch(url);
        } catch {
        }
      });
    }
  };
  setTimeout(run, 0);
}

export function usePhotoUrl(path: string | null | undefined, options?: {thumb?: boolean}): string {
  const thumb = options?.thumb === true;
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    if (typeof path !== "string" || path === "") {
      setUrl("");
      return () => {
        alive = false;
      };
    }
    void resolvePhotoUrl(path, {thumb}).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [path, thumb]);
  return url;
}

export function usePhotoUrls(paths?: string[] | null, options?: {thumb?: boolean}): string[] {
  const thumb = options?.thumb === true;
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string" && p !== "") : [];
  const key = `${thumb ? "thumb" : "full"}:${list.join("|")}`;
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    if (list.length === 0) {
      setUrls([]);
      return () => {
        alive = false;
      };
    }
    Promise.all(list.map((p) => resolvePhotoUrl(p, {thumb})))
      .then((resolved) => {
        if (alive) setUrls(resolved.filter((u) => u !== ""));
      })
      .catch(() => {
        if (alive) setUrls([]);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return urls;
}
