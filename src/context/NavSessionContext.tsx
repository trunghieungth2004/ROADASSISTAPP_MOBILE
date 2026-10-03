import {createContext, useContext, useMemo, useState, type ReactNode} from "react";
import type {RouteOption} from "../api/routes";

export type NavSession = {
  route: RouteOption;
  dest: {lat: number; lng: number};
  stops: {lat: number; lng: number}[];
  seed: {lat: number; lng: number};
  width?: number;
  vehicleType?: string;
};

type NavSessionState = {
  session: NavSession | null;
  start: (next: NavSession) => void;
  clear: () => void;
};

const NavSessionContext = createContext<NavSessionState | null>(null);

export function NavSessionProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState<NavSession | null>(null);
  const value = useMemo<NavSessionState>(
    () => ({session, start: (next: NavSession) => setSession(next), clear: () => setSession(null)}),
    [session],
  );
  return <NavSessionContext.Provider value={value}>{children}</NavSessionContext.Provider>;
}

export function useNavSession(): NavSessionState {
  const ctx = useContext(NavSessionContext);
  if (!ctx) throw new Error("NavSessionProvider missing");
  return ctx;
}
