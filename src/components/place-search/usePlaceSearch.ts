import {useCallback, useRef, useState} from "react";
import {listSavedPlaces, placeKey, reverseLabel, searchDirectory, searchMapPlaces} from "../../api/places";
import type {Place} from "./PlaceSearch.types";
export type PlaceSearch = {input: string; options: Place[]; searching: boolean; selected: Place | null; handleInput: (value: string) => void; pin: (value: string) => void; select: (place: Place) => void; clear: () => void; refreshSaved: () => void; resolvePoint: (lat: number, lng: number) => Promise<string>};
const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 300;
export function usePlaceSearch({token, lang}: {token?: string; lang: string}) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRef = useRef("");
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
    timerRef.current = setTimeout(() => { void (async () => { const [base, directory, mapHits] = await Promise.all([savedNow(), searchDirectory(value, token ?? ""), searchMapPlaces(value, lang)]); if (seqRef.current !== id) return; setOptions(merge([base, directory, mapHits])); setSearching(false); })(); }, DEBOUNCE_MS);
  }, [lang, token, merge, savedNow]);
  const handleInput = useCallback((value: string) => { setInput(value); lastRef.current = value; if (value === "") { if (timerRef.current) clearTimeout(timerRef.current); seqRef.current += 1; setSearching(false); void savedNow().then(setOptions); return; } run(value); }, [run, savedNow]);
  const pin = useCallback((value: string) => { if (timerRef.current) clearTimeout(timerRef.current); seqRef.current += 1; setInput(value); setSearching(false); void savedNow().then(setOptions); }, [savedNow]);
  const select = useCallback((place: Place) => { if (timerRef.current) clearTimeout(timerRef.current); seqRef.current += 1; setSelected(place); setInput(place.label); setOptions([]); setSearching(false); }, []);
  const clear = useCallback(() => { setSelected(null); setInput(""); setOptions([]); setSearching(false); }, []);
  const refreshSaved = useCallback(() => { if (lastRef.current.trim().length >= MIN_QUERY_LEN) { run(lastRef.current); return; } void savedNow().then(setOptions); }, [run, savedNow]);
  const resolvePoint = useCallback((lat: number, lng: number) => reverseLabel(lat, lng, lang), [lang]);
  return {input, options, searching, selected, handleInput, pin, select, clear, refreshSaved, resolvePoint};
}
