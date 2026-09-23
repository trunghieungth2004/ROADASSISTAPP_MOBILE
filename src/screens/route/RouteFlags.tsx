import {useCallback, useEffect, useRef, useState, type MutableRefObject} from "react";
import {flagsNear, type Flag} from "../../api/flags";
import type {CamState} from "./types";
import {HCMC_CENTER} from "./types";
import FlagMapLayers from "../../components/FlagMapLayers";

type Props = {
  camRef: MutableRefObject<CamState>;
  token: string | null;
  refreshKey: number;
  onPick: (flag: Flag) => void;
  subscribeRegionDid: (cb: () => void) => () => void;
};

const RADIUS = 3000;
const REFETCH_MOVE_METERS = 500;
const REFETCH_INTERVAL_MS = 10000;

const distMeters = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const x = ((bLng - aLng) * Math.PI) / 180 * Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  const y = ((bLat - aLat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371000;
};

export default function RouteFlags({camRef, token, refreshKey, onPick, subscribeRegionDid}: Props) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const handlePick = useCallback((f: Flag) => pickRef.current(f), []);
  const lastFetchRef = useRef<{lat: number; lng: number; at: number} | null>(null);
  const fetchAt = useCallback(async (c: [number, number], key: string, alive: () => boolean): Promise<void> => {
    const started = Date.now();
    console.log("[hazard] fetch start", c[1].toFixed(4), c[0].toFixed(4));
    try {
      const list = await flagsNear(c[1], c[0], RADIUS, key);
      console.log("[hazard] fetch done", Date.now() - started, "ms, count", list.length);
      if (alive()) {
        lastFetchRef.current = {lat: c[1], lng: c[0], at: Date.now()};
        setFlags(list.slice(0, 150));
      }
    } catch (err) {
      console.log("[hazard] fetch failed", Date.now() - started, "ms", err instanceof Error ? err.message : err);
      return;
    }
  }, []);
  useEffect(() => {
    if (!token) {
      setFlags([]);
      return;
    }
    let alive = true;
    const key = token;
    const isAlive = (): boolean => alive;
    const load = (): void => {
      const c = camRef.current?.center ?? HCMC_CENTER;
      lastFetchRef.current = {lat: c[1], lng: c[0], at: Date.now()};
      void fetchAt(c, key, isAlive);
    };
    void load();
    const timer = setInterval(() => {
      load();
    }, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [camRef, token, refreshKey, fetchAt]);
  useEffect(() => {
    let mounted = true;
    const unsub = subscribeRegionDid(() => {
      if (!mounted || !token) return;
      const c = camRef.current?.center ?? HCMC_CENTER;
      const last = lastFetchRef.current;
      const now = Date.now();
      if (last) {
        const moved = distMeters(last.lat, last.lng, c[1], c[0]);
        if (moved < REFETCH_MOVE_METERS && now - last.at < REFETCH_INTERVAL_MS) return;
      }
      lastFetchRef.current = {lat: c[1], lng: c[0], at: now};
      void fetchAt(c, token, () => mounted);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [camRef, token, subscribeRegionDid, fetchAt]);
  if (!token) return null;
  return <FlagMapLayers flags={flags} onPick={handlePick} />;
}
