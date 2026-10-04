import AsyncStorage from "@react-native-async-storage/async-storage";
import {api, fetchWithTimeout} from "./client";
import {CACHE_TTL_MS, cacheDel, withCache} from "../services/cache";
import {config} from "../config";
import type {Place} from "../components/place-search/PlaceSearch.types";

export type SavedPlace = {
  id: string;
  userId: string;
  label: string;
  lat: number;
  lng: number;
  createdAt?: string;
  updatedAt?: string;
};

type DirectoryHit = {
  kind: "shop" | "landmark";
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type MaptilerFeature = {
  place_name: string;
  center: [number, number];
  text?: string;
  properties?: {
    categories?: string[];
    "osm:tags"?: Record<string, string>;
  };
};

type CategoryLexicon = {
  key: string;
  words: string[];
  categories: string[];
  tags: {key: string; values: string[]}[];
};

const CATEGORY_LEXICON: CategoryLexicon[] = [
  {key: "park", words: ["park", "parks", "garden", "công viên"], categories: ["park"], tags: [{key: "leisure", values: ["park", "garden", "nature_reserve"]}, {key: "landuse", values: ["recreation_ground"]}]},
  {key: "landmark", words: ["landmark", "monument", "attraction", "thắng cảnh", "di tích"], categories: ["landmark", "tourism"], tags: [{key: "tourism", values: ["attraction", "viewpoint", "museum"]}, {key: "historic", values: ["monument", "memorial", "building", "castle"]}]},
  {key: "fuel", words: ["fuel", "gas", "petrol", "xăng", "trạm xăng"], categories: ["fuel", "filling station"], tags: [{key: "amenity", values: ["fuel"]}]},
  {key: "repair", words: ["repair", "garage", "sửa xe", "tiệm sửa"], categories: ["vehicle repair"], tags: [{key: "amenity", values: ["vehicle_repair"]}, {key: "shop", values: ["motorcycle_repair", "car_repair", "bicycle"]}, {key: "craft", values: ["motorcycle_repair", "car_repair"]}]},
  {key: "hospital", words: ["hospital", "clinic", "bệnh viện", "phòng khám"], categories: ["hospital", "clinic"], tags: [{key: "amenity", values: ["hospital", "clinic", "doctors"]}]},
  {key: "school", words: ["school", "university", "trường", "đại học"], categories: ["school", "university", "education"], tags: [{key: "amenity", values: ["school", "university", "college", "kindergarten"]}]},
  {key: "cafe", words: ["cafe", "coffee", "cà phê", "quán cà phê"], categories: ["cafe", "coffee"], tags: [{key: "amenity", values: ["cafe"]}]},
  {key: "restaurant", words: ["restaurant", "food", "eat", "nhà hàng", "quán ăn"], categories: ["restaurant", "food"], tags: [{key: "amenity", values: ["restaurant", "fast_food", "food_court"]}]},
  {key: "market", words: ["market", "chợ", "siêu thị", "supermarket"], categories: ["market", "supermarket"], tags: [{key: "amenity", values: ["marketplace"]}, {key: "shop", values: ["supermarket", "convenience", "mall"]}]},
  {key: "hotel", words: ["hotel", "hostel", "khách sạn", "nhà nghỉ"], categories: ["hotel", "lodging"], tags: [{key: "tourism", values: ["hotel", "hostel", "guest_house"]}]},
  {key: "bank", words: ["bank", "atm", "ngân hàng"], categories: ["bank", "atm"], tags: [{key: "amenity", values: ["bank", "atm"]}]},
  {key: "pharmacy", words: ["pharmacy", "drugstore", "nhà thuốc", "hiệu thuốc"], categories: ["pharmacy"], tags: [{key: "amenity", values: ["pharmacy"]}]},
];

function detectCategories(query: string): CategoryLexicon[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATEGORY_LEXICON.filter((entry) => entry.words.some((w) => w.length >= 2 && q.includes(w)));
}

function featureScore(feature: MaptilerFeature, tokens: string[], categories: CategoryLexicon[]): number {
  let score = 0;
  const name = `${feature.text ?? ""} ${feature.place_name}`.toLowerCase();
  for (const t of tokens) {
    if (t.length >= 2 && name.includes(t)) score += 10;
  }
  if (categories.length > 0) {
    const featureCategories = (feature.properties?.categories ?? []).map((c) => c.toLowerCase());
    const tags = feature.properties?.["osm:tags"] ?? {};
    for (const entry of categories) {
      if (entry.categories.some((c) => featureCategories.includes(c))) {
        score += 100;
        break;
      }
      const tagHit = entry.tags.some((tg) => typeof tags[tg.key] === "string" && tg.values.includes(String(tags[tg.key]).toLowerCase()));
      if (tagHit) {
        score += 100;
        break;
      }
    }
  }
  return score;
}

async function maptilerForwardRaw(query: string, lang: string, limit: number, types?: string): Promise<MaptilerFeature[]> {
  const params = new URLSearchParams({
    key: config.maptilerKey,
    language: lang === "vi" ? "vi" : "en",
    country: "vn",
    bbox: HCMC_VIEWBOX,
    limit: String(limit),
    autocomplete: "true",
  });
  if (types) params.set("types", types);
  const res = await fetchWithTimeout(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params}`);
  if (!res.ok) return [];
  const body = (await res.json()) as {features?: MaptilerFeature[]};
  return body.features ?? [];
}

function matchFeatureCategory(feature: MaptilerFeature): string | null {
  const featureCategories = (feature.properties?.categories ?? []).map((c) => c.toLowerCase());
  const tags = feature.properties?.["osm:tags"] ?? {};
  for (const entry of CATEGORY_LEXICON) {
    if (entry.categories.some((c) => featureCategories.includes(c))) return entry.key;
    const tagHit = entry.tags.some((tg) => typeof tags[tg.key] === "string" && tg.values.includes(String(tags[tg.key]).toLowerCase()));
    if (tagHit) return entry.key;
  }
  return null;
}

async function maptilerForward(query: string, lang: string, limit = 12): Promise<Place[]> {
  const namedLimit = Math.max(3, Math.round(limit / 2));
  const poiLimit = limit - namedLimit + 2;
  const [named, pois] = await Promise.all([maptilerForwardRaw(query, lang, namedLimit), maptilerForwardRaw(query, lang, poiLimit, "poi")]);
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const categories = detectCategories(query);
  const seen = new Set<string>();
  const hits: {place: Place; score: number; index: number}[] = [];
  [...named, ...pois]
    .filter((f) => Array.isArray(f.center) && f.center.length >= 2)
    .forEach((f, index) => {
      const lat = f.center[1];
      const lng = f.center[0];
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      hits.push({
        place: {label: f.place_name, lat, lng, source: "map" as const, tags: f.properties?.["osm:tags"], category: matchFeatureCategory(f) || undefined},
        score: featureScore(f, tokens, categories),
        index,
      });
    });
  if (categories.length > 0) hits.sort((a, b) => b.score - a.score || a.index - b.index);
  return hits.map((h) => h.place);
}

const MIN_QUERY = 3;
const HCMC_VIEWBOX = "106.35,10.36,106.92,10.94";

export function formatPoint(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function placeKey(p: {lat: number; lng: number}): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export async function searchMapPlaces(query: string, lang: string, limit = 12): Promise<Place[]> {
  if (query.trim().length < MIN_QUERY) return [];
  try {
    return await maptilerForward(query.trim(), lang, limit);
  } catch {
    return [];
  }
}

export async function reverseLabel(lat: number, lng: number, lang: string, signal?: AbortSignal): Promise<string> {
  const cached = await geoGet(lat, lng, lang);
  if (cached !== null) return cached;
  if (!config.maptilerKey) return formatPoint(lat, lng);
  try {
    const params = new URLSearchParams({
      key: config.maptilerKey,
      language: lang === "vi" ? "vi" : "en",
      limit: "1",
    });
    const res = await fetchWithTimeout(`https://api.maptiler.com/geocoding/${lng},${lat}.json?${params}`, signal ? {signal} : {});
    if (!res.ok) return formatPoint(lat, lng);
    const body = (await res.json()) as {features?: MaptilerFeature[]};
    const label = body.features?.[0]?.place_name ?? formatPoint(lat, lng);
    void geoPut(lat, lng, lang, label);
    return label;
  } catch {
    return formatPoint(lat, lng);
  }
}

export async function clearGeocodeCache(): Promise<void> {
  geoMem.clear();
  try {
    await AsyncStorage.removeItem(GEO_STORAGE_KEY);
  } catch {
    return;
  }
}

const GEO_STORAGE_KEY = "roadassist.geocodeCache";
const GEO_MAX = 300;

const geoMem = new Map<string, string>();
let geoLoaded = false;

function geoKey(lat: number, lng: number, lang: string): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)},${lang === "vi" ? "vi" : "en"}`;
}

async function geoLoad(): Promise<void> {
  if (geoLoaded) return;
  geoLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(GEO_STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Array<[string, string]>;
    if (!Array.isArray(entries)) return;
    for (const [k, v] of entries.slice(-GEO_MAX)) {
      if (typeof k === "string" && typeof v === "string") geoMem.set(k, v);
    }
  } catch {
    return;
  }
}

async function geoGet(lat: number, lng: number, lang: string): Promise<string | null> {
  const hit = geoMem.get(geoKey(lat, lng, lang));
  if (hit) return hit;
  await geoLoad();
  return geoMem.get(geoKey(lat, lng, lang)) ?? null;
}

async function geoPut(lat: number, lng: number, lang: string, label: string): Promise<void> {
  geoMem.set(geoKey(lat, lng, lang), label);
  while (geoMem.size > GEO_MAX) {
    const oldest = geoMem.keys().next();
    if (oldest.done) break;
    geoMem.delete(oldest.value);
  }
  try {
    await AsyncStorage.setItem(GEO_STORAGE_KEY, JSON.stringify([...geoMem.entries()].slice(-GEO_MAX)));
  } catch {
    return;
  }
}

export async function searchDirectory(query: string, token: string, limit = 5): Promise<Place[]> {
  if (query.trim().length < MIN_QUERY || !token) return [];
  try {
    const hits = await api.post<DirectoryHit[]>("/places/search", {q: query.trim(), limit}, token);
    return (hits ?? []).map((h) => ({
      label: h.label,
      lat: h.lat,
      lng: h.lng,
      source: "directory" as const,
      id: h.id,
      category: h.kind === "shop" ? "store" : "landmark",
    }));
  } catch {
    return [];
  }
}

export async function savePlace(payload: {label: string; lat: number; lng: number}, token: string): Promise<SavedPlace> {
  const saved = await api.post<SavedPlace>("/places/save", payload, token);
  cacheDel(`savedPlaces:${token}`);
  return saved;
}

export function listSavedPlaces(token: string): Promise<SavedPlace[]> {
  return withCache(`savedPlaces:${token}`, CACHE_TTL_MS.savedPlaces, async () => {
    const hits = await api.post<SavedPlace[]>("/places/saved", {}, token);
    return hits ?? [];
  });
}

export async function removeSavedPlace(placeId: string, token: string): Promise<{deleted: number}> {
  const res = await api.post<{deleted: number}>("/places/unsave", {placeId}, token);
  cacheDel(`savedPlaces:${token}`);
  return res;
}
