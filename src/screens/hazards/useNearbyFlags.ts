import {useCallback, useEffect, useState} from "react";
import {flagsNear, type Flag} from "../../api/flags";
import {toMessage} from "../../api/client";
import {createTaskEpoch} from "../route/taskEpoch";
import {pruneFlag} from "./hazardFilter";

export const NEARBY_RADIUS_M = 2000;

export function useNearbyFlags(
  token: string | null,
  pos: {lat: number; lng: number} | null,
  active: boolean,
) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epoch] = useState(createTaskEpoch);
  const lat = pos?.lat ?? null;
  const lng = pos?.lng ?? null;
  const load = useCallback(
    async (mode: "initial" | "refresh"): Promise<void> => {
      if (!token || lat === null || lng === null || !active) {
        setFlags([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const id = epoch.claim();
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const list = await flagsNear(lat, lng, NEARBY_RADIUS_M, token);
        if (!epoch.current(id)) return;
        setFlags(list);
      } catch (err) {
        if (!epoch.current(id)) return;
        setError(toMessage(err));
      } finally {
        if (epoch.current(id)) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, lat, lng, active, epoch],
  );
  useEffect(() => {
    void load("initial");
  }, [load]);
  const refresh = useCallback((): void => {
    void load("refresh");
  }, [load]);
  const removeLocal = useCallback((flagId: string): void => {
    setFlags((prev) => pruneFlag(prev, flagId));
  }, []);
  const clearError = useCallback((): void => setError(null), []);
  return {flags, loading, refreshing, error, refresh, removeLocal, clearError};
}
