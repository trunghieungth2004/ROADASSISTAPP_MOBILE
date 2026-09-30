import {useEffect, useState} from "react";
import {formatPoint, reverseLabel} from "../../api/places";
import {stopCacheKey} from "./routeSummary";
import type {Stop} from "./types";

const cache = new Map<string, string>();

export function useStopLabels(stops: Stop[], lang: string): string[] {
  const [labels, setLabels] = useState<string[]>(() => stops.map((s) => cache.get(stopCacheKey(s.lat, s.lng)) ?? formatPoint(s.lat, s.lng)));
  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = await Promise.all(
        stops.map(async (s) => {
          const key = stopCacheKey(s.lat, s.lng);
          const hit = cache.get(key);
          if (hit) return hit;
          const label = await reverseLabel(s.lat, s.lng, lang);
          cache.set(key, label);
          return label;
        }),
      );
      if (alive) setLabels(next);
    })();
    return () => {
      alive = false;
    };
  }, [stops, lang]);
  return labels;
}
