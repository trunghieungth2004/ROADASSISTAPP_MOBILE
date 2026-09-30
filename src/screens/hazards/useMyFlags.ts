import {useCallback, useEffect, useState} from "react";
import {myFlags, unflag, type Flag} from "../../api/flags";
import {toMessage} from "../../api/client";
import {createTaskEpoch} from "../route/taskEpoch";
import {pruneFlag} from "./hazardFilter";

export function useMyFlags(token: string | null) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [epoch] = useState(createTaskEpoch);
  const load = useCallback(
    async (mode: "initial" | "refresh"): Promise<void> => {
      if (!token) {
        setFlags([]);
        return;
      }
      const id = epoch.claim();
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const list = await myFlags(token);
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
    [token, epoch],
  );
  useEffect(() => {
    void load("initial");
  }, [load]);
  const refresh = useCallback((): void => {
    void load("refresh");
  }, [load]);
  const remove = useCallback(
    async (flagId: string): Promise<boolean> => {
      if (!token || busyId) return false;
      setBusyId(flagId);
      setError(null);
      try {
        await unflag(flagId, token);
        setFlags((prev) => prev.filter((f) => f.id !== flagId));
        return true;
      } catch (err) {
        setError(toMessage(err));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [token, busyId],
  );
  const clearError = useCallback((): void => setError(null), []);
  const removeLocal = useCallback((flagId: string): void => {
    setFlags((prev) => pruneFlag(prev, flagId));
  }, []);
  return {flags, loading, refreshing, busyId, error, refresh, remove, removeLocal, clearError};
}
