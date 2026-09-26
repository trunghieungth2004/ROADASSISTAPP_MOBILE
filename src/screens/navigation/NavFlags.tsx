import {useCallback, useEffect, useRef, useState} from "react";
import {flagsNear, type Flag} from "../../api/flags";
import FlagMapLayers from "../../components/FlagMapLayers";
import {distBetween} from "./navUtils";

type Props = {
  pos: {lat: number; lng: number} | null;
  token: string | null;
  refreshKey: number;
  uid: string | null;
  votedIds: Set<string>;
  deniedIds: Set<string>;
  suppressAuto: boolean;
  arrived: boolean;
  onPick: (flag: Flag) => void;
  onAutoFlag: (flag: Flag | null) => void;
};

const RADIUS = 3000;
const MIN_MOVE = 500;
const HEARTBEAT_MS = 60000;
const POPUP_METERS = 150;
const POPUP_EXIT_METERS = 225;

export default function NavFlags({pos, token, refreshKey, uid, votedIds, deniedIds, suppressAuto, arrived, onPick, onAutoFlag}: Props) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const handlePick = useCallback((f: Flag) => pickRef.current(f), []);
  const autoRef = useRef(onAutoFlag);
  autoRef.current = onAutoFlag;
  const lastRef = useRef<{lat: number; lng: number; at: number} | null>(null);
  const shownRef = useRef(new Set<string>());
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!token || !pos) {
      if (!token) setFlags([]);
      return;
    }
    let alive = true;
    const key = token;
    const p = pos;
    const last = lastRef.current;
    const moved = last
      ? Math.hypot((p.lat - last.lat) * 111320, (p.lng - last.lng) * 111320 * Math.cos((p.lat * Math.PI) / 180))
      : Number.POSITIVE_INFINITY;
    if (moved < MIN_MOVE && last && Date.now() - last.at < HEARTBEAT_MS) return;
    lastRef.current = {lat: p.lat, lng: p.lng, at: Date.now()};
    void (async () => {
      try {
        const list = await flagsNear(p.lat, p.lng, RADIUS, key);
        if (alive) setFlags(list.slice(0, 150));
      } catch {
        return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [pos, token, refreshKey]);
  useEffect(() => {
    if (!pos) return;
    if (openIdRef.current) {
      const open = flags.find((f) => f.id === openIdRef.current);
      const d = open ? distBetween(pos, {lat: open.lat, lng: open.lng}) : Number.POSITIVE_INFINITY;
      if (!open || d > POPUP_EXIT_METERS || open.status !== "1") {
        openIdRef.current = null;
        autoRef.current(null);
        return;
      }
    }
    if (suppressAuto || arrived) return;
    const eligible = (f: Flag): boolean =>
      f.status === "1" &&
      (uid == null || f.reporterId !== uid) &&
      !votedIds.has(f.id) &&
      !deniedIds.has(f.id) &&
      !shownRef.current.has(f.id);
    let best: Flag | null = null;
    let bestDist = POPUP_METERS;
    for (const f of flags) {
      if (!eligible(f)) continue;
      const d = distBetween(pos, {lat: f.lat, lng: f.lng});
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    if (best) {
      shownRef.current.add(best.id);
      openIdRef.current = best.id;
      autoRef.current(best);
    }
  }, [flags, pos, uid, votedIds, deniedIds, suppressAuto, arrived]);
  if (!token) return null;
  return <FlagMapLayers flags={flags} onPick={handlePick} />;
}
