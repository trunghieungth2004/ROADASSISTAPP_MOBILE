import {useCallback, useEffect, useRef, useState} from "react";
import {useWindowDimensions} from "react-native";
import {listSavedPlaces, placeKey, reverseLabel, searchDirectory, searchMapPlaces} from "../../api/places";
import type {Place, PlaceSource} from "./PlaceSearch.types";
import {dropShopDuplicates, toShopPlace, type ShopEntry} from "./shopMerge";
export type PlaceSearch = {input: string; options: Place[]; searching: boolean; selected: Place | null; handleInput: (value: string) => void; pin: (value: string) => void; select: (place: Place) => void; clear: () => void; refreshSaved: () => void; resolvePoint: (lat: number, lng: number) => Promise<string>};
const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 300;
const limitForWidth = (width: number): {total: number; directory: number} => {
  if (width < 380) return {total: 10, directory: 4};
  if (width < 600) return {total: 14, directory: 6};
  return {total: 20, directory: 8};
};
export type ShopFetcher = (query: string) => Promise<ShopEntry[]>;

export function usePlaceSearch({token, lang, sources, shops, mapFilter, query, onQuery}: {
  token?: string;
  lang: string;
  sources?: PlaceSource[];
  shops?: ShopFetcher;
  mapFilter?: (place: Place) => boolean;
  query?: string;
  onQuery?: (q: string) => void;
}) {
  const [innerInput, setInnerInput] = useState(query ?? "");
  const input = query !== undefined ? query : innerInput;
  const setInput = useCallback((value: string) => {
    onQuery?.(value);
    setInnerInput(value);
  }, [onQuery]);
  const [options, setOptions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRef = useRef("");
  const {width} = useWindowDimensions();
  const merge = useCallback((lists: Place[][]): Place[] => {
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const list of lists) { for (const p of list) { const key = placeKey(p); if (seen.has(key)) continue; seen.add(key); out.push(p); } }
    return out;
  }, []);
  const savedNow = useCallback(async (): Promise<Place[]> => {
    if (!token) return [];
    try { const saved = await listSavedPlaces(token); return saved.map((s) => ({label: s.label, lat: s.lat, lng: s.lng, source: "saved" as const, id: s.id})); } catch { return []; }
  }, [token]);
  const run = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = (seqRef.current += 1);
    if (value.trim().length < MIN_QUERY_LEN) { setSearching(false); void savedNow().then((base) => { if (seqRef.current === id) setOptions(base); }); return; }
    setSearching(true);
    timerRef.current = setTimeout(() => { void (async () => {
      const limits = limitForWidth(width);
      const want = (source: PlaceSource): boolean => sources === undefined || sources.includes(source);
      const [base, directory, mapHits, shopEntries] = await Promise.all([
        want("saved") ? savedNow() : Promise.resolve([]),
        want("directory") ? searchDirectory(value, token ?? "", limits.directory) : Promise.resolve([]),
        want("map") ? searchMapPlaces(value, lang, limits.total) : Promise.resolve([]),
        want("shop") && shops ? shops(value).catch((): ShopEntry[] => []) : Promise.resolve([]),
      ]);
      if (seqRef.current !== id) return;
      const shopPlaces = shopEntries
        .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
        .map((s) => toShopPlace(s as ShopEntry & {lat: number; lng: number}));
      const mapFiltered = mapFilter ? mapHits.filter(mapFilter) : mapHits;
      const mapDeduped = want("shop") ? dropShopDuplicates(mapFiltered, shopEntries) : mapFiltered;
      const mapCapped = want("shop") ? mapDeduped.slice(0, 5) : mapDeduped;
      setOptions(merge([base, shopPlaces, directory, mapCapped]).slice(0, limits.total));
      setSearching(false);
    })(); }, DEBOUNCE_MS);
  }, [lang, token, merge, savedNow, width, sources, shops]);
  const handleInput = useCallback((value: string) => { setInput(value); lastRef.current = value; if (value === "") { if (timerRef.current) clearTimeout(timerRef.current); seqRef.current += 1; setSearching(false); void savedNow().then(setOptions); return; } run(value); }, [run, savedNow, setInput]);
  const pin = useCallback((value: string) => { if (timerRef.current) clearTimeout(timerRef.current); seqRef.current += 1; setInput(value); setSearching(false); void savedNow().then(setOptions); }, [savedNow, setInput]);
  const select = useCallback((place: Place) => { if (timerRef.current) clearTimeout(timerRef.current); seqRef.current += 1; setSelected(place); setInput(place.label); setOptions([]); setSearching(false); }, [setInput]);
  const clear = useCallback(() => { setSelected(null); setInput(""); setOptions([]); setSearching(false); }, [setInput]);
  const refreshSaved = useCallback(() => { if (lastRef.current.trim().length >= MIN_QUERY_LEN) { run(lastRef.current); return; } void savedNow().then(setOptions); }, [run, savedNow, setInput]);
  const resolvePoint = useCallback((lat: number, lng: number) => reverseLabel(lat, lng, lang), [lang]);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    seqRef.current += 1;
  }, []);
  return {input, options, searching, selected, handleInput, pin, select, clear, refreshSaved, resolvePoint};
}
