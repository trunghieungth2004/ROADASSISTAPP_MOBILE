import * as ImagePicker from "expo-image-picker";
import {getApps} from "firebase/app";
import {getDownloadURL, getStorage, ref, uploadBytes} from "firebase/storage";
import {useEffect, useState} from "react";
import {Image} from "react-native";
import {requestCameraPermission, requestMediaLibraryPermission} from "./permissions";

export const TICKET_PHOTO_MAX = 5;

export const PHOTO_PERMISSION_ERROR = "photo-permission";

export type PhotoSource = "camera" | "library";

export function isPhotoPermissionError(err: unknown): boolean {
  return err instanceof Error && err.message === PHOTO_PERMISSION_ERROR;
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
  const out: string[] = [];
  for (const uri of uris.slice(0, room)) {
    try {
      const compressed = await compressPhoto(uri);
      out.push(compressed);
    } catch {
      out.push(uri);
    }
  }
  return out;
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

async function compressPhoto(uri: string): Promise<string> {
  try {
    const manipulator = await import("expo-image-manipulator");
    const done = await manipulator.manipulateAsync(uri, [{resize: {width: 1280}}], {compress: 0.7, format: manipulator.SaveFormat.JPEG});
    return done.uri;
  } catch {
    return uri;
  }
}

async function uploadToDirectory(directory: string, uris: string[]): Promise<string[]> {
  const apps = getApps();
  if (apps.length === 0 || uris.length === 0) return [];
  const storage = getStorage(apps[0]);
  const limited = uris.slice(0, TICKET_PHOTO_MAX);
  const stamp = Date.now();
  return Promise.all(
    limited.map(async (uri, i) => {
      const res = await fetch(uri);
      const blob = await res.blob();
      const path = `${directory}/${stamp}-${i}.jpg`;
      await uploadBytes(ref(storage, path), blob, {contentType: "image/jpeg"});
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

const urlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
let cacheLoaded = false;
let cacheLoading: Promise<void> | null = null;

async function storageModule(): Promise<UrlStore | null> {
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    return mod.default;
  } catch {
    return null;
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
      cacheLoaded = true;
    })();
  }
  return cacheLoading;
}

function persistUrlCache(): void {
  void (async () => {
    const store = await storageModule();
    if (!store) return;
    try {
      await store.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(urlCache)));
    } catch {
    }
  })();
}

export async function resolvePhotoUrl(path: string): Promise<string> {
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

const PREFETCH_PHOTOS_MAX = 8;
const prefetchedBytes = new Set<string>();

export function prefetchFlagPhotos(groups: string[][]): void {
  const paths: string[] = [];
  const firstPerFlag: string[] = [];
  for (const group of groups) {
    let first: string | null = null;
    for (const path of group) {
      if (typeof path !== "string" || path === "") continue;
      paths.push(path);
      if (first === null) first = path;
    }
    if (first !== null) firstPerFlag.push(first);
  }
  if (paths.length === 0) return;
  for (const path of paths) void resolvePhotoUrl(path);
  for (const path of firstPerFlag.slice(0, PREFETCH_PHOTOS_MAX)) {
    void resolvePhotoUrl(path).then((url) => {
      if (url === "" || prefetchedBytes.has(url)) return;
      prefetchedBytes.add(url);
      try {
        if (typeof Image.prefetch === "function") void Image.prefetch(url);
      } catch {
      }
    });
  }
}

export function usePhotoUrls(paths?: string[] | null): string[] {
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string" && p !== "") : [];
  const key = list.join("|");
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    if (list.length === 0) {
      setUrls([]);
      return () => {
        alive = false;
      };
    }
    Promise.all(list.map((p) => resolvePhotoUrl(p)))
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
