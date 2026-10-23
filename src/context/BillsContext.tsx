import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {AppState} from "react-native";
import {myBills, type Bill} from "../api/bills";
import {useAuth} from "./AuthContext";

export type BillsState = {
  bills: Bill[];
  dueCount: number;
  dueTotal: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const EMPTY_BILLS: BillsState = {
  bills: [],
  dueCount: 0,
  dueTotal: 0,
  loading: false,
  error: null,
  refresh: async () => undefined,
};

const BillsContext = createContext<BillsState>(EMPTY_BILLS);

export function BillsProvider({children}: {children: ReactNode}) {
  const {token} = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) {
      if (alive.current) {
        setBills([]);
        setError(null);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const rows = await myBills(current, 50);
      if (alive.current) {
        setBills(Array.isArray(rows) ? rows : []);
        setError(null);
      }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "bills");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, token]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  const value = useMemo(() => {
    const due = bills.filter((row) => row.status !== "VOID" && row.due > 0);
    return {
      bills,
      dueCount: due.length,
      dueTotal: due.reduce((sum, row) => sum + row.due, 0),
      loading,
      error,
      refresh,
    };
  }, [bills, loading, error, refresh]);
  return <BillsContext.Provider value={value}>{children}</BillsContext.Provider>;
}

export function useBills(): BillsState {
  return useContext(BillsContext);
}
