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
const REFETCH_HEARTBEAT_MS = 60000;

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
  const lastFetchRef = useRef<{lat: number; lng: number} | null>(null);
  const fetchAt = useCallback(async (c: [number, number], key: string, alive: () => boolean): Promise<void> => {
    try {
      const list = await flagsNear(c[1], c[0], RADIUS, key);
      if (alive()) {
        lastFetchRef.current = {lat: c[1], lng: c[0]};
        setFlags(list.slice(0, 150));
      }
    } catch {
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
      const c = camRef.current?.center;
      if (!c) return;
      lastFetchRef.current = {lat: c[1], lng: c[0]};
      void fetchAt(c, key, isAlive);
    };
    void load();
    const timer = setInterval(() => {
      load();
    }, REFETCH_HEARTBEAT_MS);
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
      if (last) {
        const moved = distMeters(last.lat, last.lng, c[1], c[0]);
        if (moved < REFETCH_MOVE_METERS) return;
      }
      lastFetchRef.current = {lat: c[1], lng: c[0]};
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
